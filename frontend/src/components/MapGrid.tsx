"use client";

import { FACTIONS } from "@/lib/contract";
import { cn } from "@/lib/format";

export function MapGrid({
  map,
  size = "md",
  className,
}: {
  map: number[];
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cells = Array.from({ length: 25 }, (_, index) => map[index] ?? 0);
  const emojiSize =
    size === "lg" ? "text-2xl sm:text-3xl" : size === "md" ? "text-base" : "text-[10px]";

  return (
    <div className={cn("grid grid-cols-5 gap-1.5 sm:gap-2", className)}>
      {cells.map((owner, index) => {
        const meta = owner > 0 ? FACTIONS[owner - 1] : null;
        const label = meta
          ? `Tile ${index}: ${meta.name}`
          : `Tile ${index}: unclaimed`;
        return (
          <div
            key={index}
            title={label}
            aria-label={label}
            className={cn("map-cell", meta && "map-cell-owned")}
            style={
              meta
                ? {
                    background: `linear-gradient(135deg, ${meta.color}38, ${meta.color}0e)`,
                    borderColor: `${meta.color}66`,
                  }
                : undefined
            }
          >
            {meta ? (
              <span
                className={cn(
                  "select-none",
                  size === "sm"
                    ? "font-mono text-[10px] font-bold"
                    : emojiSize,
                )}
                style={size === "sm" ? { color: meta.color } : undefined}
              >
                {size === "sm" ? meta.name.slice(0, 1) : meta.emoji}
              </span>
            ) : (
              <span className="h-1 w-1 rounded-full bg-line sm:h-1.5 sm:w-1.5" />
            )}
            {size !== "sm" ? (
              <span className="absolute left-1.5 top-1 font-mono text-[8px] text-white/35">
                {index + 1}
              </span>
            ) : null}
            {meta && size === "lg" ? (
              <span
                className="absolute bottom-1 right-1.5 font-mono text-[8px] uppercase tracking-wider"
                style={{ color: meta.color }}
              >
                {meta.name}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
      {FACTIONS.map((meta) => (
        <span key={meta.id} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ background: meta.color }}
          />
          {meta.name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm border border-line bg-panel" />
        Unclaimed
      </span>
    </div>
  );
}
