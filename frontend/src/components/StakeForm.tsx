"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameSnapshot } from "@/hooks/useGame";
import { FACTIONS } from "@/lib/contract";
import {
  formatUnits,
  formatWar,
  parseUnits,
  cn,
} from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { FaucetButton } from "./FaucetButton";
import { Spinner } from "./ui";

export function StakeForm({
  snapshot,
  onEnlist,
  busy,
}: {
  snapshot: GameSnapshot;
  onEnlist: (stake: bigint) => Promise<boolean>;
  busy: boolean;
}) {
  const { accountId, connect, connecting } = useWallet();
  const { config, member, balance, clock, todayEnlistment, currentDayState } =
    snapshot;
  const decimals = config.decimals;
  const minRaw = BigInt(config.min_stake);
  const maxRaw = BigInt(config.max_stake_per_day);
  const available = BigInt(balance || "0");
  const [input, setInput] = useState("");

  const defaultInput = useMemo(
    () => formatUnits(minRaw, decimals, 0).replace(/,/g, ""),
    [minRaw, decimals],
  );

  useEffect(() => {
    if (!input) setInput(defaultInput);
  }, [defaultInput, input]);

  if (!accountId) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="btn btn-primary w-full"
      >
        {connecting ? "Connecting…" : "Connect wallet to enlist"}
      </button>
    );
  }

  if (!member) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-xs text-muted">
        Pick a faction above to unlock the stake form.
      </div>
    );
  }

  const meta = FACTIONS[member.faction];

  if (todayEnlistment) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: `${meta.color}44`,
          background: `${meta.color}0d`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="text-sm font-semibold text-white">
              You&apos;re in for Day {clock.current_day}
            </span>
          </div>
          <span className="chip" style={{ borderColor: `${meta.color}44` }}>
            enlisted
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <div className="tabular text-sm font-semibold text-white">
              {formatWar(todayEnlistment.stake, decimals, 0)}
            </div>
            <div className="text-[10px] text-muted">staked</div>
          </div>
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <div className="tabular text-sm font-semibold text-white">
              {formatUnits(todayEnlistment.power, decimals, 0)}
            </div>
            <div className="text-[10px] text-muted">power</div>
          </div>
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <div className="tabular text-sm font-semibold text-white">
              ×{(todayEnlistment.multiplier_bp / 10_000).toFixed(2)}
            </div>
            <div className="text-[10px] text-muted">
              streak {todayEnlistment.streak}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Come back when the day flips. The contract settles overdue days
          automatically when the next enlistment arrives (up to 7 days).
        </p>
      </div>
    );
  }

  let raw = 0n;
  let parseError = "";
  try {
    raw = parseUnits(input, decimals);
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Invalid amount";
  }

  const nextStreak =
    member.last_enlist_day + 1 === clock.current_day
      ? member.streak + 1
      : 1;
  const multiplierBp =
    10_000 +
    Math.min(nextStreak, config.streak_cap_days) * config.streak_step_bp;
  const power = (raw * BigInt(multiplierBp)) / 10_000n;

  let validation = parseError;
  if (!validation && raw < minRaw) {
    validation = `Minimum stake is ${formatWar(minRaw, decimals, 0)}.`;
  } else if (!validation && raw > maxRaw) {
    validation = `Maximum stake is ${formatWar(maxRaw, decimals, 0)}.`;
  } else if (!validation && raw > available) {
    validation = `You only have ${formatWar(available, decimals, 2)} available.`;
  } else if (!validation && raw === 0n) {
    validation = "Enter an amount above zero.";
  }

  const capRaw = maxRaw < available ? maxRaw : available;
  const quickValues = [
    { label: "MIN", raw: minRaw },
    { label: "10K", raw: parseUnits("10000", decimals) },
    { label: "50K", raw: parseUnits("50000", decimals) },
    { label: "MAX", raw: capRaw },
  ].filter((item) => item.raw >= minRaw && item.raw <= capRaw);

  const setRaw = (value: bigint) => {
    setInput(formatUnits(value, decimals, 0).replace(/,/g, ""));
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Enlist · Day {clock.current_day}</div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Put your WAR on the line
          </h3>
        </div>
        <span
          className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: meta.color, background: meta.soft }}
        >
          {meta.emoji} {meta.name}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
        <span>
          Available{" "}
          <span className="font-mono text-slate-300">
            {formatWar(available, decimals)}
          </span>
        </span>
        <span>
          Locked{" "}
          <span className="font-mono text-slate-300">
            {formatWar(member.locked_stake, decimals)}
          </span>
        </span>
      </div>

      <div className="mt-2">
        <div className="relative">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            inputMode="decimal"
            spellCheck={false}
            aria-label="Stake amount in WAR"
            className="input pr-16"
            placeholder="1000"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] tracking-[0.14em] text-muted">
            WAR
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {quickValues.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setRaw(item.raw)}
              className="flex-1 rounded-lg border border-line bg-black/20 px-2 py-1.5 font-mono text-[10px] tracking-[0.08em] text-muted transition hover:border-slate-500/60 hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-line/70 bg-black/20 p-2 text-center">
        <div>
          <div className="tabular text-sm font-semibold text-white">
            {formatUnits(power, decimals, 0)}
          </div>
          <div className="text-[10px] text-muted">power</div>
        </div>
        <div>
          <div className="tabular text-sm font-semibold text-gold">
            ×{(multiplierBp / 10_000).toFixed(2)}
          </div>
          <div className="text-[10px] text-muted">
            streak {nextStreak} day{nextStreak === 1 ? "" : "s"}
          </div>
        </div>
        <div>
          <div className="tabular text-sm font-semibold text-dogs">
            {config.loss_burn_bp / 100}%
          </div>
          <div className="text-[10px] text-muted">burn if you lose</div>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Power = stake × streak multiplier. The weaker faction gets a ×
        {(config.underdog_bonus_bp / 10_000).toFixed(2)} underdog bonus at
        settlement, so raw size is not the whole story.
      </p>

      {validation ? (
        <div className="mt-3 rounded-lg border border-dogs/30 bg-dogs/[0.07] px-3 py-2 text-[11px] text-dogs">
          {validation}
          {available < minRaw ? (
            <div className="mt-2">
              <FaucetButton label="Get test WAR" className="!px-3 !py-1.5 !text-xs" />
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        onClick={() => onEnlist(raw)}
        disabled={Boolean(validation) || busy}
        className={cn(
          "btn mt-3 w-full",
          member.faction === 0 ? "btn-dogs" : "btn-cats",
        )}
      >
        {busy ? <Spinner /> : null}
        {currentDayState?.cold
          ? "Enlist (day is cold)"
          : `Enlist ${formatUnits(raw, decimals, 0)} WAR`}
      </button>
    </div>
  );
}
