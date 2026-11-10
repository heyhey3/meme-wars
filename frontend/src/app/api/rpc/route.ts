import { NextResponse } from "next/server";

/**
 * Same-origin read proxy for the contract.
 *
 * FastNear's public endpoint rate-limits browser bursts and does not support
 * JSON-RPC batches. This route keeps the browser on our origin, validates
 * that the request only reads the configured contract, and caches short-lived
 * view answers so one open tab does not hammer the public RPC.
 *
 * Writes still go through the wallet selector / wallet provider.
 */

const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || "war-demo.testnet";
const NETWORK_ID =
  process.env.NEXT_PUBLIC_NETWORK_ID === "mainnet" ? "mainnet" : "testnet";
const UPSTREAM =
  process.env.NEAR_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://test.rpc.fastnear.com";
// Public RPCs rate-limit independently. If the configured endpoint is busy,
// try the NEAR Foundation public endpoint before failing the browser request.
const FALLBACK_UPSTREAM =
  process.env.NEAR_RPC_FALLBACK_URL || `https://rpc.${NETWORK_ID}.near.org`;
const UPSTREAMS = [...new Set([UPSTREAM, FALLBACK_UPSTREAM].filter(Boolean))];
const UPSTREAM_TIMEOUT_MS = 6_000;

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: {
    request_type?: string;
    account_id?: string;
    method_name?: string;
    args_base64?: string;
  };
}

interface CacheEntry {
  at: number;
  data: unknown;
}

const CACHE_TTL_MS: Record<string, number> = {
  get_config: 60 * 60 * 1000,
  get_seasons: 15_000,
};
const DEFAULT_TTL_MS = 1_200;
const MAX_STALE_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

function errorResponse(id: RpcRequest["id"], code: number, message: string) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    { status: code === -32600 ? 400 : 502 },
  );
}

export async function POST(request: Request) {
  let body: RpcRequest;
  try {
    body = (await request.json()) as RpcRequest;
  } catch {
    return errorResponse(null, -32600, "Invalid JSON");
  }

  const params = body.params;
  if (
    body.method !== "query" ||
    params?.request_type !== "call_function" ||
    params?.account_id !== CONTRACT_ID ||
    typeof params?.method_name !== "string"
  ) {
    return errorResponse(body.id, -32600, "Only contract view calls are proxied");
  }

  const key = `${params.method_name}:${params.args_base64 ?? ""}`;
  const now = Date.now();
  const cached = cache.get(key);
  const ttl = CACHE_TTL_MS[params.method_name] ?? DEFAULT_TTL_MS;

  if (cached && now - cached.at <= ttl) {
    return NextResponse.json(cached.data);
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const upstreamUrl of UPSTREAMS) {
      try {
        const upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        if (!upstream.ok) throw new Error(`upstream HTTP ${upstream.status}`);
        const data = (await upstream.json()) as { error?: unknown };
        if (data.error) throw new Error("upstream error");

        cache.set(key, { at: Date.now(), data });
        if (cache.size > 500) cache.clear();
        return NextResponse.json(data);
      } catch {
        // Try the next upstream, then a second round.
      }
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  if (cached && Date.now() - cached.at <= MAX_STALE_MS) {
    return NextResponse.json(cached.data);
  }
  return errorResponse(body.id, -32603, "RPC unavailable");
}
