"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { compactUnits } from "@/lib/format";
import { EventLog } from "@/components/EventLog";
import { ErrorPanel, PageSkeleton } from "@/components/PageStates";
import { Panel, Pill, StatTile } from "@/components/ui";

export default function LogPage() {
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

  const { config, stats, log } = snapshot;

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>NEP-297 EVENTS</Pill>
          <Pill>ON-CHAIN LOG</Pill>
          <Pill>latest {log.length}</Pill>
        </div>
        <h1 className="display mt-5 text-4xl text-white sm:text-5xl">
          THE WAR
          <br />
          <span className="gradient-text">LEDGER.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
          Every enlistment, mint, burn, capture and claim is an event. The
          contract keeps the latest 200 in a bounded on-chain ring buffer; this
          page reads the newest 40 with one view call.
        </p>
      </section>

      <section className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total minted"
          value={`${compactUnits(stats.reward_minted_total, config.decimals)} WAR`}
          hint="daily rewards, all time"
          tone="mint"
        />
        <StatTile
          label="Total burned"
          value={`${compactUnits(stats.burned_total, config.decimals)} WAR`}
          hint="stakes, cold days, leftovers"
          tone="dogs"
        />
        <StatTile
          label="Ledger events"
          value={`${log.length}`}
          hint="newest 40 shown"
        />
        <StatTile
          label="Contract"
          value="testnet"
          hint="every entry is a receipt"
          tone="gold"
        />
      </section>

      <section className="mt-4">
        <Panel className="p-5 sm:p-6">
          <EventLog log={log} config={config} limit={40} />
        </Panel>
      </section>

      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="btn btn-ghost">
          ← Battle
        </Link>
        <Link href="/map" className="btn btn-ghost">
          Map →
        </Link>
      </div>
    </>
  );
}
