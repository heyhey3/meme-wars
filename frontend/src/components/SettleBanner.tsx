"use client";

import { useGame } from "@/hooks/useGame";
import { useWallet } from "@/lib/wallet";
import { GAS_30 } from "@/lib/contract";
import { fc } from "@/lib/actions";
import { Spinner } from "./ui";

export function SettleBanner() {
  const { snapshot, execute, busy } = useGame();
  const { accountId, connect, connecting } = useWallet();

  if (!snapshot) return null;
  const { clock } = snapshot;
  const overdue = clock.current_day - 1 - clock.last_settled_day;
  if (overdue <= 0) return null;

  const first = clock.last_settled_day + 1;
  const last = Math.min(first + 5, clock.current_day - 1);
  const days = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const actions = days.map((day) =>
    fc("settle_day", { day }, { gas: GAS_30 }),
  );

  return (
    <div className="panel mb-6 border-gold/30 bg-gold/[0.045] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden>
          ⏳
        </span>
        <div>
          <div className="text-sm font-semibold text-gold">
            {overdue} day{overdue === 1 ? "" : "s"} ready to settle
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Settlement is permissionless. Push day {first} forward so the next
            battle can start. Unsettled days block enlistments after 7.
          </p>
        </div>
      </div>
      <div className="mt-3 shrink-0 sm:mt-0">
        {!accountId ? (
          <button
            onClick={connect}
            disabled={connecting}
            className="btn btn-primary w-full sm:w-auto"
          >
            {connecting ? "Connecting…" : "Connect to settle"}
          </button>
        ) : (
          <button
            onClick={() =>
              execute(
                actions,
                days.length === 1
                  ? `Day ${first} settled`
                  : `${days.length} days settled`,
              )
            }
            disabled={busy}
            className="btn btn-primary w-full sm:w-auto"
          >
            {busy ? <Spinner /> : null}
            {days.length === 1
              ? `Settle day ${first}`
              : `Settle ${days.length} days`}
          </button>
        )}
      </div>
    </div>
  );
}
