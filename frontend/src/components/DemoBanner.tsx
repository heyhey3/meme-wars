"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";

export function DemoBanner() {
  const { snapshot } = useGame();
  // Show immediately on first load; hide only once a production-length day is read.
  const dayLength = snapshot?.config.day_length_ns ?? 60_000_000_000;
  if (dayLength > 120_000_000_000) return null;

  return (
    <div className="border-b border-gold/20 bg-gold/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-[11px] leading-relaxed sm:px-6">
        <span className="font-mono font-semibold uppercase tracking-[0.14em] text-gold">
          Accelerated demo
        </span>
        <span className="text-slate-300">
          1 day = 60 seconds. Production uses 24 hours. Parameters are fixed at
          launch and readable on-chain.
        </span>
        <Link
          href="/about"
          className="font-medium text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
        >
          Details
        </Link>
      </div>
    </div>
  );
}
