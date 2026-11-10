"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { useWallet } from "@/lib/wallet";
import { FACTIONS } from "@/lib/contract";
import { compactUnits, formatWar, cn } from "@/lib/format";
import { MapGrid } from "@/components/MapGrid";
import { ErrorPanel, PageSkeleton } from "@/components/PageStates";
import { Panel, Pill, SectionHeader, Spinner, StatTile } from "@/components/ui";

export default function SeasonPage() {
  const { snapshot, loading, error, refresh, busy, executeOne } = useGame();
  const { accountId, connect, connecting } = useWallet();

  if (loading && !snapshot) return <PageSkeleton />;
  if (!snapshot) {
    return (
      <ErrorPanel
        error={error ?? "The contract did not answer."}
        onRetry={refresh}
      />
    );
  }

  const { season, latestSeason, seasonPlayer, latestSeasonPlayer, clock, config, stats, factions, member } =
    snapshot;
  const seasonNumber = season?.season ?? clock.current_season;
  const startDay =
    season?.start_day ?? (seasonNumber - 1) * config.season_days + 1;
  const endDay = season?.end_day ?? seasonNumber * config.season_days;
  const dayInSeason = Math.max(
    1,
    Math.min(config.season_days, clock.current_day - startDay + 1),
  );
  const daysLeft = Math.max(0, endDay - clock.current_day);
  const tiles = season?.tiles ?? [
    factions[0]?.season_tiles ?? 0,
    factions[1]?.season_tiles ?? 0,
  ];
  const tileTotal = Math.max(1, tiles[0] + tiles[1]);
  const bonusEstimate =
    season?.settled && season
      ? season.bonus_pool
      : (BigInt(stats.treasury_balance) * BigInt(config.season_bonus_bp)) /
        10_000n;

  const claimTarget =
    latestSeasonPlayer?.eligible && !latestSeasonPlayer.claimed
      ? latestSeasonPlayer
      : seasonPlayer?.eligible && !seasonPlayer.claimed
        ? seasonPlayer
        : null;
  const finishedSeasons = snapshot.seasons.filter((item) => item.settled);
  const claimSeasonState = claimTarget
    ? snapshot.seasons.find((item) => item.season === claimTarget.season) ??
      (latestSeason?.season === claimTarget.season ? latestSeason : null)
    : null;
  const currentWinner =
    season?.winner !== null && season?.winner !== undefined
      ? FACTIONS[season.winner]
      : null;
  const latestWinner =
    latestSeason?.winner !== null && latestSeason?.winner !== undefined
      ? FACTIONS[latestSeason.winner]
      : null;

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>SEASONS</Pill>
          <Pill>{config.season_days} DAYS</Pill>
          <Pill>{config.season_bonus_bp / 100}% TREASURY BONUS</Pill>
        </div>
        <h1 className="display mt-5 text-4xl text-white sm:text-5xl">
          A WAR WITH
          <br />
          <span className="gradient-text">A DEADLINE.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
          Every {config.season_days} days the map resets. The faction holding
          the most tiles when the final day settles takes a slice of the
          treasury, split by season power. The hall of fame keeps the result.
        </p>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow={`Season ${seasonNumber} · ${season?.settled ? "settled" : "live"}`}
            title={
              currentWinner
                ? `${currentWinner.name} controls the map`
                : season?.settled
                  ? "The season ended in a tie"
                  : `Day ${dayInSeason} of ${config.season_days}`
            }
            action={<Pill>{daysLeft} days left</Pill>}
          />
          <div className="mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            <span>
              DOGS <span className="text-dogs">{tiles[0]}</span>
            </span>
            <span>{season?.settled ? "final-map tiles" : "live map tiles"}</span>
            <span>
              <span className="text-cats">{tiles[1]}</span> CATS
            </span>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[#0a1120]">
            {tiles[0] + tiles[1] > 0 ? (
              <>
                <div
                  className="bg-gradient-to-r from-dogs-soft to-dogs transition-all"
                  style={{ width: `${(tiles[0] / tileTotal) * 100}%` }}
                />
                <div className="flex-1 bg-gradient-to-r from-cats to-cats-soft" />
              </>
            ) : (
              <div className="h-full w-full bg-line/50" />
            )}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-line/70 bg-black/20 p-3">
              <div className="eyebrow">Season bonus</div>
              <div className="tabular mt-1 text-lg font-semibold text-gold">
                {formatWar(bonusEstimate, config.decimals, 0)}
              </div>
              <div className="text-[10px] text-muted">
                {season?.settled ? "in the season vault" : "estimated at settle"}
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-black/20 p-3">
              <div className="eyebrow">Treasury</div>
              <div className="tabular mt-1 text-lg font-semibold text-white">
                {compactUnits(stats.treasury_balance, config.decimals)}
              </div>
              <div className="text-[10px] text-muted">WAR remaining</div>
            </div>
            <div className="rounded-xl border border-line/70 bg-black/20 p-3">
              <div className="eyebrow">Season power</div>
              <div className="tabular mt-1 text-lg font-semibold text-white">
                {compactUnits(
                  (season ?? latestSeason)?.total_power[0] ?? "0",
                  config.decimals,
                )}
                <span className="text-muted"> / </span>
                {compactUnits(
                  (season ?? latestSeason)?.total_power[1] ?? "0",
                  config.decimals,
                )}
              </div>
              <div className="text-[10px] text-muted">DOGS / CATS</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Season progress</span>
              <span className="tabular">
                {dayInSeason}/{config.season_days}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#0a1120]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-dogs-soft"
                style={{
                  width: `${Math.min(100, (dayInSeason / config.season_days) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/map" className="btn btn-ghost !py-2">
              Open the map
            </Link>
            <Link href="/" className="btn btn-ghost !py-2">
              Fight today
            </Link>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader eyebrow="Your season" title="Bonus claim" />
          <div className="mt-4">
            {!accountId ? (
              <div className="text-center">
                <p className="text-xs text-muted">
                  Connect a wallet to check your season power and claim.
                </p>
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="btn btn-primary mt-3 w-full"
                >
                  {connecting ? "Connecting…" : "Connect wallet"}
                </button>
              </div>
            ) : !member ? (
              <p className="text-center text-xs text-muted">
                Join a faction first. Season power is accumulated by enlisting.
              </p>
            ) : claimTarget && claimSeasonState ? (
              <div>
                <div className="rounded-xl border border-mint/30 bg-mint/[0.06] p-4">
                  <div className="eyebrow">Season {claimTarget.season}</div>
                  <div className="tabular mt-1 text-2xl font-semibold text-mint">
                    {formatWar(claimTarget.payout_preview, config.decimals, 0)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    Your season power:{" "}
                    {compactUnits(claimTarget.power, config.decimals)} of{" "}
                    {claimSeasonState.total_power[
                      claimSeasonState.winner ?? member.faction
                    ]
                      ? compactUnits(
                          claimSeasonState.total_power[
                            claimSeasonState.winner ?? member.faction
                          ],
                          config.decimals,
                        )
                      : "0"}
                  </div>
                  <button
                    onClick={() =>
                      executeOne(
                        "claim_season",
                        { season: claimTarget.season },
                        {},
                        `Season ${claimTarget.season} bonus claimed`,
                      )
                    }
                    disabled={busy}
                    className="btn btn-primary mt-4 w-full"
                  >
                    {busy ? <Spinner /> : null}
                    Claim season bonus
                  </button>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-muted">
                  Season bonuses are split by season power, not by headcount.
                  Unclaimed bonuses are closed when the following season ends.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-[11px] leading-relaxed text-muted">
                {latestSeason?.rewards_closed ? (
                  <p>Season {latestSeason.season} rewards are closed.</p>
                ) : latestSeason && latestSeason.winner === null ? (
                  <p>
                    Season {latestSeason.season} ended in a tile tie, so no
                    bonus was released.
                  </p>
                ) : latestSeason && latestSeason.winner !== member.faction ? (
                  <p>
                    {latestWinner?.name ?? "The other faction"} won season{" "}
                    {latestSeason.season}. Only the winning faction shares the
                    bonus.
                  </p>
                ) : latestSeasonPlayer?.claimed ? (
                  <p>Your season bonus is already claimed.</p>
                ) : latestSeasonPlayer && latestSeasonPlayer.power === "0" ? (
                  <p>
                    You had no season power in season{" "}
                    {latestSeasonPlayer?.season ?? latestSeason?.season}.
                  </p>
                ) : (
                  <p>
                    No season bonus is claimable right now. The current season
                    unlocks after day {endDay}.
                  </p>
                )}
                <Link
                  href="/log"
                  className="inline-flex font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-gold"
                >
                  see season events →
                </Link>
              </div>
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {FACTIONS.map((meta) => {
          const state = factions[meta.id];
          return (
            <div
              key={meta.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: `${meta.color}40`,
                background: `linear-gradient(135deg, ${meta.color}10, transparent 70%)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{meta.emoji}</span>
                  <span
                    className="text-sm font-bold uppercase tracking-[0.1em]"
                    style={{ color: meta.color }}
                  >
                    {meta.name}
                  </span>
                </div>
                <span className="chip">
                  {state?.total_wins ?? 0} all-time wins
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/20 px-2 py-2">
                  <div className="tabular text-sm font-semibold text-white">
                    {state?.season_tiles ?? 0}
                  </div>
                  <div className="text-[10px] text-muted">season tiles</div>
                </div>
                <div className="rounded-lg bg-black/20 px-2 py-2">
                  <div className="tabular text-sm font-semibold text-white">
                    {state?.win_streak ?? 0}
                  </div>
                  <div className="text-[10px] text-muted">win streak</div>
                </div>
                <div className="rounded-lg bg-black/20 px-2 py-2">
                  <div className="tabular text-sm font-semibold text-white">
                    {state?.longest_win_streak ?? 0}
                  </div>
                  <div className="text-[10px] text-muted">longest</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-4">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Hall of fame"
            title="Finished seasons"
            action={<Pill>{finishedSeasons.length} recorded</Pill>}
          />
          {finishedSeasons.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs text-muted">
              No completed seasons yet. The first one ends on day{" "}
              {config.season_days}.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {finishedSeasons.map((item) => {
                const winner =
                  item.winner !== null ? FACTIONS[item.winner] : null;
                return (
                  <div
                    key={item.season}
                    className="rounded-xl border border-line/70 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">Season {item.season}</div>
                        <div
                          className="mt-1 text-sm font-semibold"
                          style={{ color: winner?.color ?? "#cbd5e1" }}
                        >
                          {winner ? `${winner.emoji} ${winner.name}` : "Tie"}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "chip",
                          item.rewards_closed && "!text-muted",
                        )}
                      >
                        {item.rewards_closed
                          ? "closed"
                          : !item.settled
                            ? "live"
                            : item.winner === null
                              ? "tie"
                              : "claimable"}
                      </span>
                    </div>
                    <MapGrid
                      map={item.final_map}
                      size="sm"
                      className="mt-3"
                    />
                    <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-muted">
                      <span>
                        tiles {item.tiles[0]}–{item.tiles[1]}
                      </span>
                      <span>
                        bonus {compactUnits(item.bonus_pool, config.decimals)}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-muted">
                      claimed {compactUnits(item.claimed, config.decimals)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Season bonus rate"
          value={`${config.season_bonus_bp / 100}%`}
          hint="of treasury at settle"
          tone="gold"
        />
        <StatTile
          label="Current season"
          value={`${seasonNumber}`}
          hint={`ends day ${endDay}`}
        />
        <StatTile
          label="Season vault"
          value={`${compactUnits(stats.season_reward_vault, config.decimals)} WAR`}
          hint="awaiting claims / cleanup"
          tone="mint"
        />
        <StatTile
          label="Map reset"
          value="every season"
          hint="25 tiles, clean slate"
        />
      </section>
    </>
  );
}
