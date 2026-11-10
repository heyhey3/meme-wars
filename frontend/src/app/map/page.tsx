"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { FACTIONS, parseEventData } from "@/lib/contract";
import { compactUnits } from "@/lib/format";
import { MapGrid, MapLegend } from "@/components/MapGrid";
import { ErrorPanel, PageSkeleton } from "@/components/PageStates";
import { SeasonProgress } from "@/components/SeasonProgress";
import { Panel, Pill, SectionHeader, StatTile } from "@/components/ui";

export default function MapPage() {
  const { snapshot, loading, error, refresh } = useGame();

  if (loading && !snapshot) return <PageSkeleton />;
  if (!snapshot) {
    return (
      <ErrorPanel
        error={error ?? "The contract did not answer."}
        onRetry={refresh}
      />
    );
  }

  const { map, season, clock, config, factions, log } = snapshot;
  const empty = map.every((tile) => tile === 0);
  const settledSeason = season?.settled === true;
  const shownMap = empty && settledSeason ? season?.final_map ?? map : map;
  const captures = [...log]
    .filter((entry) => entry.event === "map_capture")
    .reverse()
    .slice(0, 8);

  const title = settledSeason
    ? `Season ${season?.season} · final map`
    : `Season ${clock.current_season} · live map`;
  const subtitle = settledSeason
    ? season?.winner !== null && season?.winner !== undefined
      ? `${FACTIONS[season.winner].name} controls the final map`
      : "The season ended in a tile tie"
    : `Day ${Math.max(
        1,
        clock.current_day -
          ((season?.start_day ?? (clock.current_season - 1) * config.season_days + 1) -
            1),
      )} of ${config.season_days}`;

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>SEASON {season?.season ?? clock.current_season}</Pill>
          <Pill>{settledSeason ? "SETTLED" : "LIVE"}</Pill>
          <Pill>25 TILES</Pill>
        </div>
        <h1 className="display mt-5 text-4xl text-white sm:text-5xl">
          THE MAP
          <br />
          <span className="gradient-text">REMEMBERS.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
          Every settled day captures one tile. A second capture of the same
          tile flips its owner. After {config.season_days} days the faction
          holding the most tiles takes a slice of the treasury.
        </p>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow={title}
            title={subtitle}
            action={
              <span className="chip">
                {factions[0]?.season_tiles ?? 0}D ·{" "}
                {factions[1]?.season_tiles ?? 0}C
              </span>
            }
          />
          <MapGrid map={shownMap} size="lg" className="mt-5" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <MapLegend />
            <span className="font-mono text-[10px] text-muted">
              {shownMap.filter((tile) => tile > 0).length}/25 claimed
            </span>
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            Tile = (day − 1) mod 25. A {config.season_days}-day season over 25
            tiles means some tiles are captured more than once: a late
            recapture flips ownership. Season winners are decided by the final
            map, not by the number of daily wins.
          </p>
        </Panel>

        <div className="space-y-4">
          <SeasonProgress snapshot={snapshot} compact />

          <div className="grid grid-cols-2 gap-2.5">
            {FACTIONS.map((meta) => {
              const state = factions[meta.id];
              return (
                <div
                  key={meta.id}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: `${meta.color}44`,
                    background: `${meta.color}0b`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{meta.emoji}</span>
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: meta.color }}
                    >
                      {meta.name}
                    </span>
                  </div>
                  <div className="tabular mt-2 text-2xl font-semibold text-white">
                    {state?.season_tiles ?? 0}
                  </div>
                  <div className="text-[10px] text-muted">tiles held</div>
                  <div className="mt-2 border-t border-line/60 pt-2 font-mono text-[9px] text-muted">
                    {state?.total_wins ?? 0} wins · streak{" "}
                    {state?.win_streak ?? 0}
                  </div>
                </div>
              );
            })}
          </div>

          <Panel className="p-5">
            <SectionHeader eyebrow="Recent captures" title="Who took what" />
            {captures.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-center text-[11px] text-muted">
                No tiles captured yet. The first settlement writes the map.
              </p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {captures.map((entry) => {
                  const data = parseEventData(entry);
                  const meta =
                    entry.faction !== null
                      ? FACTIONS[entry.faction]
                      : null;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-line/70 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta?.emoji}</span>
                        <span className="text-[11px] text-slate-200">
                          {meta?.name ?? "?"} took tile #
                          {String(data.tile ?? "?")}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-muted">
                        day {entry.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </section>

      <section className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Treasury"
          value={`${compactUnits(snapshot.stats.treasury_balance, config.decimals)} WAR`}
          hint="funds the season bonus"
          tone="gold"
        />
        <StatTile
          label="Season bonus"
          value={`${compactUnits(
            snapshot.season?.settled && snapshot.season
              ? snapshot.season.bonus_pool
              : (BigInt(snapshot.stats.treasury_balance) *
                  BigInt(config.season_bonus_bp)) /
                  10_000n,
            config.decimals,
          )} WAR`}
          hint={`${config.season_bonus_bp / 100}% of treasury`}
        />
        <StatTile
          label="Season days"
          value={`${config.season_days}`}
          hint={`current day ${clock.current_day}`}
        />
        <StatTile
          label="Map reset"
          value={settledSeason ? "ready" : "at season end"}
          hint="tiles clear for the next season"
        />
      </section>

      <div className="mt-6 flex justify-center">
        <Link href="/" className="btn btn-ghost">
          ← Back to the battle
        </Link>
      </div>
    </>
  );
}
