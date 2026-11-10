"use client";

import type { Config, DayState } from "@/lib/contract";
import { compactUnits, percent, cn } from "@/lib/format";

export function TugBar({
  dayState,
  config,
  className,
  showProjection = true,
}: {
  dayState: DayState | null;
  config: Config;
  className?: string;
  showProjection?: boolean;
}) {
  const decimals = config.decimals;
  const p0 = BigInt(dayState?.total_power[0] ?? "0");
  const p1 = BigInt(dayState?.total_power[1] ?? "0");
  const total = p0 + p1;
  const dogsPct = total === 0n ? 50 : percent(p0, total);
  const catsPct = 100 - dogsPct;

  let e0 = p0;
  let e1 = p1;
  let underdog: "dogs" | "cats" | null = null;
  const bonus = BigInt(config.underdog_bonus_bp);
  if (p0 < p1) {
    e0 = (p0 * bonus) / 10_000n;
    underdog = "dogs";
  } else if (p1 < p0) {
    e1 = (p1 * bonus) / 10_000n;
    underdog = "cats";
  }
  const favored = e0 > e1 ? "DOGS" : e1 > e0 ? "CATS" : "Tie";

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-dogs">
            🐕 DOGS
          </div>
          <div className="tabular mt-1 text-2xl font-semibold text-dogs">
            {compactUnits(p0, decimals)}
          </div>
          <div className="text-[11px] text-muted">
            {dayState?.contributors[0] ?? 0} fighter
            {(dayState?.contributors[0] ?? 0) === 1 ? "" : "s"}
          </div>
        </div>
        <div className="pb-1 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            power
          </div>
          <div className="mt-1 h-px w-10 bg-line" />
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cats">
            CATS 🐈
          </div>
          <div className="tabular mt-1 text-2xl font-semibold text-cats">
            {compactUnits(p1, decimals)}
          </div>
          <div className="text-[11px] text-muted">
            {dayState?.contributors[1] ?? 0} fighter
            {(dayState?.contributors[1] ?? 0) === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="tug-track mt-3">
        <div className={cn("flex h-full w-full", total === 0n && "opacity-40")}>
          <div
            className="tug-fill tug-fill-dogs"
            style={{ width: `${dogsPct}%` }}
          />
          <div
            className="tug-fill tug-fill-cats"
            style={{ width: `${catsPct}%` }}
          />
        </div>
        <div className="tug-center" />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
        <span>{dogsPct.toFixed(1)}%</span>
        <span>{catsPct.toFixed(1)}%</span>
      </div>

      {total === 0n ? (
        <p className="mt-3 text-center text-xs text-muted">
          The tug is quiet. Enlist to move the bar.
        </p>
      ) : null}

      {showProjection && total > 0n ? (
        <div className="mt-3 rounded-lg border border-line/70 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-muted">
          <span className="font-mono uppercase tracking-[0.12em]">
            If settled now
          </span>
          <span className="mx-1.5 text-line">·</span>
          <span className="text-dogs">
            DOGS {compactUnits(e0, decimals)}
          </span>
          <span className="mx-1">vs</span>
          <span className="text-cats">
            CATS {compactUnits(e1, decimals)}
          </span>
          <span className="mx-1.5 text-line">·</span>
          <span className="text-slate-300">{favored} favored</span>
          {underdog ? (
            <div className="mt-1 text-[10px]">
              {underdog.toUpperCase()} gets the ×
              {(config.underdog_bonus_bp / 10_000).toFixed(2)} underdog bonus
              because they have less base power.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
