"use client";

import type { GameSnapshot } from "@/hooks/useGame";
import { FACTIONS } from "@/lib/contract";
import { cn, formatUnits } from "@/lib/format";

export function StreakCard({ snapshot }: { snapshot: GameSnapshot }) {
  const { member, factions, config, clock, recentEnlistments } = snapshot;

  if (!member) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center">
        <div className="text-sm text-slate-300">No streak yet</div>
        <p className="mt-1 text-[11px] text-muted">
          Join a faction and enlist on consecutive days to build power.
        </p>
      </div>
    );
  }

  const meta = FACTIONS[member.faction];
  const faction = factions[member.faction];
  const byDay = new Map(
    recentEnlistments.map((entry) => [entry.day, entry.enlistment]),
  );
  const days = Array.from({ length: 7 }, (_, index) => clock.current_day - 6 + index);
  const nextStreak =
    member.last_enlist_day + 1 === clock.current_day
      ? member.streak + 1
      : 1;
  const multiplier =
    10_000 +
    Math.min(nextStreak, config.streak_cap_days) * config.streak_step_bp;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Personal streak</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">
              {member.streak}
            </span>
            <span className="text-[11px] text-muted">
              day{member.streak === 1 ? "" : "s"} in a row
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Next multiplier</div>
          <div className="tabular mt-1 text-lg font-semibold text-gold">
            ×{(multiplier / 10_000).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        {days.map((day) => {
          const enlistment = byDay.get(day);
          const isToday = day === clock.current_day;
          const isFuture = day > clock.current_day;
          return (
            <div
              key={day}
              title={
                isFuture
                  ? `Day ${day}: not started`
                  : enlistment
                    ? `Day ${day}: ${formatUnits(enlistment.power, config.decimals, 0)} power`
                    : `Day ${day}: missed`
              }
              className={cn(
                "flex h-9 flex-1 items-center justify-center rounded-md border font-mono text-[9px]",
                isFuture
                  ? "border-line/50 bg-transparent text-muted/40"
                  : enlistment
                    ? "border-transparent text-[#07101e]"
                    : "border-line bg-black/20 text-muted/60",
                isToday && "ring-1 ring-white/30",
              )}
              style={
                enlistment && !isFuture
                  ? {
                      background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`,
                      color: "#07101e",
                    }
                  : undefined
              }
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <div className="tabular text-sm font-semibold text-white">
            {member.longest_streak}
          </div>
          <div className="text-[10px] text-muted">longest</div>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <div className="tabular text-sm font-semibold text-white">
            {member.total_enlistments}
          </div>
          <div className="text-[10px] text-muted">enlistments</div>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <div className="tabular text-sm font-semibold text-white">
            {faction?.season_tiles ?? 0}
          </div>
          <div className="text-[10px] text-muted">faction tiles</div>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Enlist every day to grow the multiplier. Miss a day and the streak
        resets. The cap is ×
        {(1 + (config.streak_cap_days * config.streak_step_bp) / 10_000).toFixed(2)}.
      </p>
    </div>
  );
}
