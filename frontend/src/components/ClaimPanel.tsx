"use client";

import { useMemo } from "react";
import { useGame, type GameSnapshot } from "@/hooks/useGame";
import { useWallet } from "@/lib/wallet";
import { FACTIONS, GAS_30, type ClaimItem } from "@/lib/contract";
import { fc, type NearAction } from "@/lib/actions";
import { formatWar, cn } from "@/lib/format";
import { Spinner } from "./ui";

interface ClaimEntry {
  item: ClaimItem;
  actions: NearAction[];
  total: bigint;
}

export function ClaimPanel({ snapshot }: { snapshot: GameSnapshot }) {
  const { accountId, connect, connecting } = useWallet();
  const { execute, busy } = useGame();

  const entries = useMemo<ClaimEntry[]>(() => {
    const sorted = [...snapshot.claims].sort((a, b) => a.day - b.day);
    const result: ClaimEntry[] = [];
    for (const item of sorted) {
      if (!item.settled) continue;
      const actions: NearAction[] = [];
      let total = 0n;
      if (!item.stake_claimed && item.stake_payout !== "0") {
        actions.push(fc("claim_stake", { day: item.day }, { gas: GAS_30 }));
        total += BigInt(item.stake_payout);
      }
      if (
        !item.reward_claimed &&
        !item.rewards_closed &&
        item.reward_payout !== "0"
      ) {
        actions.push(fc("claim_reward", { day: item.day }, { gas: GAS_30 }));
        total += BigInt(item.reward_payout);
      }
      if (actions.length > 0) result.push({ item, actions, total });
    }
    return result;
  }, [snapshot.claims]);

  const visible: ClaimEntry[] = [];
  let actionCount = 0;
  for (const entry of entries) {
    if (actionCount + entry.actions.length > 10) break;
    visible.push(entry);
    actionCount += entry.actions.length;
  }
  const actions = visible.flatMap((entry) => entry.actions);
  const total = visible.reduce((sum, entry) => sum + entry.total, 0n);
  const truncated = visible.length < entries.length;

  if (!accountId) {
    return (
      <div className="text-center">
        <p className="text-xs text-muted">
          Connect a wallet to see your claimable stakes and rewards.
        </p>
        <button
          onClick={connect}
          disabled={connecting}
          className="btn btn-ghost mt-3 w-full"
        >
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  if (!snapshot.member) {
    return (
      <p className="text-center text-xs text-muted">
        Join a faction and enlist to start earning claims.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-center text-xs text-muted">
        Nothing to claim yet. Win a day or wait for yesterday&apos;s settlement.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Claimable</div>
          <div className="tabular mt-1 text-xl font-semibold text-mint">
            {formatWar(total, snapshot.config.decimals)}
          </div>
        </div>
        <span className="chip">{entries.length} day{entries.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {visible.map(({ item, total: entryTotal }) => {
          const meta = FACTIONS[item.faction];
          const won = item.winner === item.faction;
          return (
            <div
              key={item.day}
              className="flex items-center justify-between gap-3 rounded-lg border border-line/70 bg-black/20 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-slate-200">
                    Day {item.day}
                  </div>
                  <div className="truncate text-[10px] text-muted">
                    {item.cold
                      ? "cold day · full refund"
                      : won
                        ? "faction win · stake + reward"
                        : "faction loss · 80% refund"}
                  </div>
                </div>
              </div>
              <div className="tabular shrink-0 text-right font-mono text-[11px] text-mint">
                +{formatWar(entryTotal, snapshot.config.decimals)}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => execute(actions, "Claims collected")}
        disabled={busy || actions.length === 0}
        className={cn("btn btn-primary mt-3 w-full")}
      >
        {busy ? <Spinner /> : null}
        Claim {visible.length} day{visible.length === 1 ? "" : "s"}
      </button>
      {truncated ? (
        <p className="mt-2 text-center text-[10px] text-muted">
          Showing the oldest claims first. Claim again for the rest.
        </p>
      ) : null}
      <p className="mt-2 text-center text-[10px] leading-relaxed text-muted">
        Unclaimed rewards can be closed by anyone after{" "}
        {snapshot.config.claim_window_days} days. Stakes never expire.
      </p>
    </div>
  );
}
