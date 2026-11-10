"use client";

import Link from "next/link";
import type { GameSnapshot } from "@/hooks/useGame";
import { FACTIONS } from "@/lib/contract";
import { formatWar, compactUnits } from "@/lib/format";

export function SeasonProgress({
  snapshot,
  compact = false,
}: {
  snapshot: GameSnapshot;
  compact?: boolean;
}) {
  const { season, clock, config, factions, stats } = snapshot;
  const seasonNumber = season?.season ?? clock.current_season;
  const startDay =
    season?.start_day ?? (seasonNumber - 1) * config.season_days + 1;
  const endDay = season?.end_day ?? seasonNumber * config.season_days;
  const dayInSeason = Math.min(
    config.season_days,
    Math.max(1, clock.current_day - startDay + 1),
  );
  const progress = Math.min(100, (dayInSeason / config.season_days) * 100);
  const tiles = season?.tiles ?? [
    factions[0]?.season_tiles ?? 0,
    factions[1]?.season_tiles ?? 0,
  ];
  const bonus =
    season?.settled && season
      ? season.bonus_pool
      : (BigInt(stats.treasury_balance) * BigInt(config.season_bonus_bp)) /
        10_000n;
  const winner =
    season?.winner !== null && season?.winner !== undefined
      ? FACTIONS[season.winner]
      : null;

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-line/70 bg-black/20 p-4"
          : "panel p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Season {seasonNumber}</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {season?.settled
              ? winner
                ? `${winner.name} took the season`
                : "Season ended in a tie"
              : `Day ${dayInSeason} of ${config.season_days}`}
          </div>
        </div>
        <Link
          href="/season"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-gold"
        >
          season →
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-muted">
        <span>
          DOGS <span className="text-dogs">{tiles[0]}</span>
        </span>
        <span>
          tiles · day {dayInSeason}/{config.season_days}
        </span>
        <span>
          <span className="text-cats">{tiles[1]}</span> CATS
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0a1120]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-dogs-soft transition-all"
          style={{ width: `${Math.max(2, progress)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Season bonus</div>
          <div className="tabular mt-0.5 text-sm font-semibold text-gold">
            {formatWar(bonus, config.decimals, 0)}
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Treasury</div>
          <div className="tabular mt-0.5 text-sm font-semibold text-white">
            {compactUnits(stats.treasury_balance, config.decimals)}
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Days left</div>
          <div className="tabular mt-0.5 text-sm font-semibold text-white">
            {Math.max(0, endDay - clock.current_day)}
          </div>
        </div>
      </div>
    </div>
  );
}
