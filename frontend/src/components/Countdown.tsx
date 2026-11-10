"use client";

import { useEffect, useState } from "react";
import type { ClockInfo } from "@/lib/contract";
import { formatCountdown, cn } from "@/lib/format";

export function Countdown({
  clock,
  fetchedAt,
  className,
}: {
  clock: ClockInfo;
  fetchedAt: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedMs = Math.max(0, now - fetchedAt);
  const chainNow =
    BigInt(clock.now_ns) + BigInt(elapsedMs) * 1_000_000n;
  const remainingNs = BigInt(clock.day_end_ns) - chainNow;
  const remainingMs = Number(
    (remainingNs > 0n ? remainingNs : 0n) / 1_000_000n,
  );
  const urgent = remainingMs > 0 && remainingMs <= 10_000;
  const dayLength = BigInt(
    Math.max(1, clock.day_end_ns - clock.day_start_ns),
  );
  const elapsed = chainNow - BigInt(clock.day_start_ns);
  const progress = Number(
    (elapsed < 0n ? 0n : elapsed > dayLength ? dayLength : elapsed) *
      1000n /
      dayLength,
  ) / 10;
  const isDemo = clock.day_length_ns <= 120_000_000_000;

  return (
    <div className={cn("panel-flat p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">
            Day {clock.current_day} · Season {clock.current_season}
          </div>
          <div className="mt-1 text-xs text-muted">
            {remainingMs > 0 ? "Battle ends in" : "Waiting for settlement"}
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "tabular text-3xl font-semibold leading-none text-white sm:text-4xl",
              urgent && "countdown-urgent",
            )}
          >
            {formatCountdown(remainingMs)}
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {isDemo ? "60-second demo day" : "24-hour day"}
          </div>
        </div>
      </div>
      <div className="countdown-progress mt-3 h-1.5 overflow-hidden rounded-full bg-[#0a1120]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold via-dogs-soft to-dogs transition-[width] duration-700"
          style={{ width: `${Math.max(2, progress)}%` }}
        />
      </div>
    </div>
  );
}
