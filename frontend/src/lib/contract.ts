export const NETWORK_ID =
  process.env.NEXT_PUBLIC_NETWORK_ID === "mainnet" ? "mainnet" : "testnet";
export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || "meme-wars.testnet";
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://test.rpc.fastnear.com";
// Browser reads go through our own origin; the API route proxies to the RPC.
const VIEW_URL = "/api/rpc";
export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  (NETWORK_ID === "mainnet"
    ? "https://explorer.near.org"
    : "https://explorer.testnet.near.org");

export const GAS_30 = "30000000000000";
export const GAS_60 = "60000000000000";
export const GAS_100 = "100000000000000";
export const STORAGE_DEPOSIT = "10000000000000000000000"; // 0.01 NEAR

export type U128 = string;

export interface Config {
  name: string;
  symbol: string;
  decimals: number;
  icon: string | null;
  genesis_supply: U128;
  treasury_allocation: U128;
  community_allocation: U128;
  demo_faucet_pool: U128;
  demo_faucet_amount: U128;
  demo_mode: boolean;
  day_length_ns: number;
  epoch_start_ns: number;
  season_days: number;
  daily_mint_pool: U128;
  loss_burn_bp: number;
  underdog_bonus_bp: number;
  cold_line: U128;
  cold_burn: U128;
  min_stake: U128;
  max_stake_per_day: U128;
  streak_step_bp: number;
  streak_cap_days: number;
  claim_window_days: number;
  season_bonus_bp: number;
}

export interface ClockInfo {
  now_ns: number;
  epoch_start_ns: number;
  day_length_ns: number;
  current_day: number;
  day_start_ns: number;
  day_end_ns: number;
  last_settled_day: number;
  current_season: number;
  season_days: number;
}

export interface Stats {
  total_supply: U128;
  genesis_supply: U128;
  treasury_balance: U128;
  faucet_balance: U128;
  locked_total: U128;
  reward_vault: U128;
  season_reward_vault: U128;
  burned_total: U128;
  reward_minted_total: U128;
  current_day: number;
  last_settled_day: number;
  current_season: number;
  demo_mode: boolean;
}

export interface FactionState {
  id: number;
  win_streak: number;
  longest_win_streak: number;
  season_tiles: number;
  total_wins: number;
  total_enlistments: number;
}

export interface DayState {
  day: number;
  total_power: [U128, U128];
  effective_power: [U128, U128];
  total_stake: [U128, U128];
  contributors: [number, number];
  winner: number | null;
  cold: boolean;
  settled: boolean;
  reward_pool: U128;
  base_power_winner: U128;
  burned: U128;
  tile: number | null;
  claimed_reward: U128;
  claimed_stake: [U128, U128];
  rewards_closed: boolean;
}

export interface Enlistment {
  faction: number;
  stake: U128;
  streak: number;
  multiplier_bp: number;
  power: U128;
  claimed_stake: boolean;
  claimed_reward: boolean;
}

export interface EnlistmentAt {
  day: number;
  enlistment: Enlistment;
}

export interface Member {
  faction: number;
  locked_stake: U128;
  last_enlist_day: number;
  streak: number;
  longest_streak: number;
  joined_day: number;
  total_enlistments: number;
}

export interface SeasonState {
  season: number;
  start_day: number;
  end_day: number;
  winner: number | null;
  bonus_pool: U128;
  claimed: U128;
  total_power: [U128, U128];
  tiles: [number, number];
  final_map: number[];
  settled: boolean;
  rewards_closed: boolean;
}

export interface SeasonPlayer {
  season: number;
  faction: number | null;
  power: U128;
  claimed: boolean;
  eligible: boolean;
  payout_preview: U128;
}

export interface ClaimItem {
  day: number;
  faction: number;
  stake: U128;
  stake_payout: U128;
  stake_claimed: boolean;
  reward_payout: U128;
  reward_claimed: boolean;
  settled: boolean;
  winner: number | null;
  cold: boolean;
  rewards_closed: boolean;
}

export interface FaucetState {
  demo_mode: boolean;
  registered: boolean;
  claimed: boolean;
  amount: U128;
  remaining: U128;
  eligible: boolean;
}

export interface LogEntry {
  id: number;
  day: number;
  event: string;
  account: string | null;
  faction: number | null;
  amount: U128 | null;
  data: string;
}

export interface FactionMeta {
  id: number;
  name: string;
  emoji: string;
  color: string;
  soft: string;
  tagline: string;
}

export const FACTIONS: FactionMeta[] = [
  {
    id: 0,
    name: "DOGS",
    emoji: "🐕",
    color: "#ff5a3c",
    soft: "rgba(255, 90, 60, 0.14)",
    tagline: "Loyal, loud, and first to the gate.",
  },
  {
    id: 1,
    name: "CATS",
    emoji: "🐈",
    color: "#2dd4ff",
    soft: "rgba(45, 212, 255, 0.14)",
    tagline: "Patient, precise, and above the rules.",
  },
];

export function factionMeta(id: number | null | undefined): FactionMeta | null {
  if (id === null || id === undefined) return null;
  return FACTIONS[id] ?? null;
}

interface RpcCall {
  method: string;
  args?: Record<string, unknown>;
}

function requestBody(call: RpcCall, id: number) {
  return {
    jsonrpc: "2.0",
    id,
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT_ID,
      method_name: call.method,
      args_base64: btoa(JSON.stringify(call.args ?? {})),
    },
  };
}

function decodeResult(result: { error?: unknown; result?: { result?: number[] } }): unknown {
  if (result.error) {
    const error = result.error as {
      cause?: { name?: string; info?: unknown };
      message?: string;
    };
    throw new Error(
      error.cause?.name || error.message || "RPC view call failed",
    );
  }
  const bytes = result.result?.result;
  if (!Array.isArray(bytes)) {
    throw new Error("Malformed RPC response");
  }
  const text = new TextDecoder().decode(Uint8Array.from(bytes));
  return text.length ? JSON.parse(text) : null;
}

async function viewOnce<T>(
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(VIEW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({ method, args }, Date.now())),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const json = await response.json();
  return decodeResult(json) as T;
}

export async function view<T>(
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  try {
    return await viewOnce<T>(method, args);
  } catch {
    // Public RPCs occasionally rate-limit or drop a request. One quiet retry
    // keeps the 4.5s poll from flashing an error for a single lost response.
    await new Promise((resolve) => setTimeout(resolve, 350));
    return viewOnce<T>(method, args);
  }
}

/**
 * Batches all view calls into one HTTP request. Falls back to sequential
 * calls if the provider does not support JSON-RPC batches.
 */
// FastNear's public endpoint does not support JSON-RPC batches. Remember the
// answer after the first probe so polling does not pay for a failed request
// every few seconds.
let batchSupport: boolean | null =
  process.env.NEXT_PUBLIC_RPC_BATCH === "1" ? null : false;

export async function viewBatch<T extends unknown[]>(
  calls: RpcCall[],
): Promise<T> {
  if (calls.length === 0) return [] as unknown as T;

  if (batchSupport !== false) {
    try {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          calls.map((call, index) => requestBody(call, index)),
        ),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const json = await response.json();
      if (!Array.isArray(json)) throw new Error("Batch not supported");
      const sorted = [...json].sort((a, b) => Number(a.id) - Number(b.id));
      batchSupport = true;
      return sorted.map((item) => decodeResult(item)) as T;
    } catch {
      batchSupport = false;
    }
  }

  // Small concurrency pool: enough to feel instant, gentle enough for a
  // public RPC. FastNear does not support JSON-RPC batches.
  const results = new Array(calls.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < calls.length) {
      const index = nextIndex++;
      results[index] = await view(calls[index].method, calls[index].args);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, calls.length) }, () => worker()),
  );
  return results as T;
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_URL}/transactions/${hash}`;
}

export function explorerAccountUrl(accountId: string): string {
  return `${EXPLORER_URL}/accounts/${accountId}`;
}

export function parseEventData(entry: LogEntry): Record<string, unknown> {
  try {
    return JSON.parse(entry.data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

