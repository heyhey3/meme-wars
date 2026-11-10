"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { useWallet } from "@/lib/wallet";
import {
  FACTIONS,
  GAS_30,
  GAS_60,
  GAS_100,
  STORAGE_DEPOSIT,
  canClaimFaucet,
} from "@/lib/contract";
import { fc, type NearAction } from "@/lib/actions";
import { compactUnits, formatWar } from "@/lib/format";
import { ClaimPanel } from "@/components/ClaimPanel";
import { Countdown } from "@/components/Countdown";
import { EventLog } from "@/components/EventLog";
import { FactionPicker } from "@/components/FactionPicker";
import { LastResult } from "@/components/LastResult";
import { MapGrid, MapLegend } from "@/components/MapGrid";
import { ErrorPanel, PageSkeleton } from "@/components/PageStates";
import { SeasonProgress } from "@/components/SeasonProgress";
import { SettleBanner } from "@/components/SettleBanner";
import { StakeForm } from "@/components/StakeForm";
import { StreakCard } from "@/components/StreakCard";
import { TugBar } from "@/components/TugBar";
import { Panel, Pill, SectionHeader, StatTile } from "@/components/ui";

export default function BattlePage() {
  const { snapshot, loading, error, refresh, busy, execute, executeOne } =
    useGame();
  const { accountId } = useWallet();

  if (loading && !snapshot) return <PageSkeleton />;
  if (!snapshot) {
    return (
      <ErrorPanel
        error={error ?? "The contract did not answer."}
        onRetry={refresh}
      />
    );
  }

  const {
    config,
    clock,
    stats,
    factions,
    currentDayState,
    lastDayState,
    member,
    season,
  } = snapshot;
  const decimals = config.decimals;

  const handleJoin = async (faction: number) => {
    if (!accountId) return false;
    const actions: NearAction[] = [];
    if (!snapshot.faucet?.registered) {
      actions.push(
        fc(
          "storage_deposit",
          { account_id: accountId, registration_only: true },
          { gas: GAS_60, deposit: STORAGE_DEPOSIT },
        ),
      );
    }
    if (canClaimFaucet(snapshot.faucet)) {
      actions.push(fc("claim_faucet", {}, { gas: GAS_30 }));
    }
    actions.push(fc("join_faction", { faction }, { gas: GAS_30 }));
    return execute(actions, `Welcome to ${FACTIONS[faction].name}.`);
  };

  const handleEnlist = (stake: bigint) =>
    executeOne(
      "enlist",
      { stake: stake.toString() },
      { gas: GAS_100 },
      `Enlisted ${formatWar(stake, decimals, 0)} for day ${clock.current_day}.`,
    );

  const todaysStake =
    BigInt(currentDayState?.total_stake[0] ?? "0") +
    BigInt(currentDayState?.total_stake[1] ?? "0");
  const mapIsEmpty = snapshot.map.every((tile) => tile === 0);
  const mapToShow =
    mapIsEmpty && season?.settled ? season.final_map : snapshot.map;
  const mapLabel =
    mapIsEmpty && season?.settled
      ? `Final map · Season ${season.season}`
      : "Live map · current season";

  return (
    <>
      <SettleBanner />

      {error ? (
        <div className="mb-4 rounded-lg border border-dogs/30 bg-dogs/[0.05] px-3 py-2 text-[11px] text-dogs">
          RPC reconnecting: {error}. Showing the last known chain state.
        </div>
      ) : null}

      <section className="relative overflow-hidden">
        <span className="hero-scan" aria-hidden />
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <div className="reveal flex flex-wrap items-center gap-2">
              <Pill>NEAR HACKATHON 2026</Pill>
              <Pill>TRACK · MEMECOINS</Pill>
              <Pill>NEP-141</Pill>
              <Pill className="!border-mint/30 !text-mint">
                <span className="live-dot" /> on-chain
              </Pill>
            </div>
            <h1
              className="reveal display mt-5 text-5xl text-white sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              THE JOKE
              <br />
              <span className="gradient-text">NEEDS RULES.</span>
            </h1>
            <p
              className="reveal mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base"
              style={{ animationDelay: "160ms" }}
            >
              Two factions fight a daily on-chain war. Winners mint, losers
              burn, and the map remembers. No admin, no oracle, no backend —
              just a NEP-141 token with a mechanic.
            </p>
            <div
              className="reveal mt-6 flex flex-wrap gap-2"
              style={{ animationDelay: "240ms" }}
            >
              <a href="#battle" className="btn btn-primary">
                Enter the battle
              </a>
              <Link href="/about" className="btn btn-ghost">
                Read the rules
              </Link>
              <Link href="/map" className="btn btn-ghost">
                See the map
              </Link>
            </div>
            <p
              className="reveal mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
              style={{ animationDelay: "300ms" }}
            >
              Day {clock.current_day} · Season {clock.current_season} ·{" "}
              {clock.day_length_ns <= 120_000_000_000
                ? "60s demo days"
                : "24h days"}
            </p>
          </div>

          <div
            className="reveal grid grid-cols-2 gap-2.5"
            style={{ animationDelay: "180ms" }}
          >
            <StatTile
              label="Total supply"
              value={compactUnits(stats.total_supply, decimals)}
              hint="WAR in existence"
            />
            <StatTile
              label="Burned by war"
              value={compactUnits(stats.burned_total, decimals)}
              hint="gone forever"
              tone="dogs"
            />
            <StatTile
              label="Treasury"
              value={compactUnits(stats.treasury_balance, decimals)}
              hint="season prizes + cold burns"
              tone="gold"
            />
            <StatTile
              label="In today’s war"
              value={compactUnits(todaysStake, decimals)}
              hint="WAR staked today"
              tone="cats"
            />
          </div>
        </div>
      </section>

      <section
        id="battle"
        className="reveal mt-10 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"
        style={{ animationDelay: "360ms" }}
      >
        <div className="space-y-4">
          <Panel className="p-5">
            <SectionHeader
              eyebrow={`Day ${clock.current_day} · live battle`}
              title="The tug of war"
              action={
                <Pill>
                  <span className="live-dot" /> live
                </Pill>
              }
            />
            <Countdown
              clock={clock}
              fetchedAt={snapshot.fetchedAt}
              className="mt-4"
            />
            <TugBar
              dayState={currentDayState}
              config={config}
              className="mt-5"
            />
            <div className="hairline my-5" />
            <LastResult
              dayState={lastDayState}
              config={config}
              factions={factions}
            />
          </Panel>

          <Panel className="p-5">
            <FactionPicker
              member={member}
              factions={factions}
              onJoin={handleJoin}
              busy={busy}
            />
            {member ? (
              <>
                <div className="hairline my-5" />
                <StakeForm
                  snapshot={snapshot}
                  onEnlist={handleEnlist}
                  busy={busy}
                />
              </>
            ) : null}
          </Panel>

          <Panel className="p-5">
            <StreakCard snapshot={snapshot} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionHeader eyebrow="Your wallet" title="Claims" />
            <div className="mt-4">
              <ClaimPanel snapshot={snapshot} />
            </div>
          </Panel>

          <Panel className="p-5">
            <EventLog
              log={snapshot.log}
              config={config}
              limit={10}
              showLink
            />
          </Panel>

          <SeasonProgress snapshot={snapshot} compact />
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionHeader
            eyebrow={mapLabel}
            title="The map remembers"
            action={
              <Link
                href="/map"
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-gold"
              >
                open map →
              </Link>
            }
          />
          <MapGrid map={mapToShow} className="mt-4" size="sm" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <MapLegend />
            <span className="font-mono text-[10px] text-muted">
              DOGS {factions[0]?.season_tiles ?? 0} · CATS{" "}
              {factions[1]?.season_tiles ?? 0}
            </span>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader eyebrow="The loop" title="How the war works" />
          <ol className="mt-4 space-y-3">
            {[
              [
                "Pick a side",
                "Join DOGS or CATS once. Your faction is permanent for this deployment.",
              ],
              [
                "Enlist once a day",
                "Stake WAR. Consecutive days raise your power multiplier up to 2×.",
              ],
              [
                "Settle the day",
                "The weaker side gets an underdog bonus. Winners split the day's mint; losing stakes are burned 20%.",
              ],
              [
                "Win the season",
                "Each win captures a tile. After 30 days the faction with the most tiles takes a slice of the treasury.",
              ],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-black/30 font-mono text-[10px] text-gold">
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-medium text-white">{title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/about"
            className="mt-4 inline-flex font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-gold"
          >
            full rules, parameters and limitations →
          </Link>
        </Panel>
      </section>

      <section className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Reward vault"
          value={`${compactUnits(stats.reward_vault, decimals)} WAR`}
          hint="minted, waiting to be claimed"
          tone="mint"
        />
        <StatTile
          label="Locked stakes"
          value={`${compactUnits(stats.locked_total, decimals)} WAR`}
          hint="not transferable while enlisted"
        />
        <StatTile
          label="Season vault"
          value={`${compactUnits(stats.season_reward_vault, decimals)} WAR`}
          hint="season bonuses awaiting claims"
          tone="gold"
        />
        <StatTile
          label="Days settled"
          value={`${stats.last_settled_day}`}
          hint={`current day ${stats.current_day}`}
        />
      </section>
    </>
  );
}
