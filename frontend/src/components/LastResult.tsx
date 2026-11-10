"use client";

import Link from "next/link";
import type { Config, DayState, FactionState } from "@/lib/contract";
import { FACTIONS } from "@/lib/contract";
import { formatWar, compactUnits } from "@/lib/format";

export function LastResult({
  dayState,
  config,
  factions,
}: {
  dayState: DayState | null;
  config: Config;
  factions: FactionState[];
}) {
  if (!dayState) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-[11px] text-muted">
        No battle has settled yet. The first result lands when day 1 ends.
      </div>
    );
  }

  const winner = dayState.winner;
  const meta = winner !== null ? FACTIONS[winner] : null;
  const title = dayState.cold
    ? "Cold day"
    : winner === null
      ? "Tie"
      : `${meta?.name} won day ${dayState.day}`;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: meta ? `${meta.color}40` : undefined,
        background: meta
          ? `linear-gradient(120deg, ${meta.color}10, transparent 70%)`
          : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Last settled · Day {dayState.day}</div>
          <div
            className="mt-1 text-lg font-semibold"
            style={{ color: meta?.color ?? "#e8eefb" }}
          >
            {title}
          </div>
        </div>
        {dayState.tile !== null ? (
          <Link
            href="/map"
            className="chip transition hover:border-slate-500/60 hover:text-slate-200"
          >
            tile #{dayState.tile}
          </Link>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <div className="tabular text-sm font-semibold text-mint">
            {formatWar(dayState.reward_pool, config.decimals, 0)}
          </div>
          <div className="text-[10px] text-muted">minted</div>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <div className="tabular text-sm font-semibold text-dogs">
            {formatWar(dayState.burned, config.decimals, 0)}
          </div>
          <div className="text-[10px] text-muted">burned</div>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <div className="tabular text-sm font-semibold text-white">
            {dayState.contributors[0] + dayState.contributors[1]}
          </div>
          <div className="text-[10px] text-muted">fighters</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] text-muted">
        <span>
          DOGS{" "}
          <span className="text-dogs">
            {compactUnits(dayState.effective_power[0], config.decimals)}
          </span>
        </span>
        <span className="text-line">/</span>
        <span>
          CATS{" "}
          <span className="text-cats">
            {compactUnits(dayState.effective_power[1], config.decimals)}
          </span>
        </span>
        <span className="text-line">·</span>
        <span>
          {factions[0]?.win_streak ?? 0}D / {factions[1]?.win_streak ?? 0}C
          streak
        </span>
      </div>
    </div>
  );
}
