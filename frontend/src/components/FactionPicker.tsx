"use client";

import { useState } from "react";
import {
  FACTIONS,
  type FactionState,
  type Member,
} from "@/lib/contract";
import { cn } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { Spinner } from "./ui";

export function FactionPicker({
  member,
  factions,
  onJoin,
  busy,
}: {
  member: Member | null;
  factions: FactionState[];
  onJoin: (faction: number) => Promise<boolean>;
  busy: boolean;
}) {
  const { accountId, connect, connecting } = useWallet();
  const [selected, setSelected] = useState<number | null>(null);

  if (member) {
    const meta = FACTIONS[member.faction];
    const state = factions[member.faction];
    return (
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: `${meta.color}55`,
          background: `linear-gradient(135deg, ${meta.color}14, transparent 70%)`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.emoji}</span>
            <div>
              <div className="eyebrow">Your faction</div>
              <div className="text-lg font-semibold" style={{ color: meta.color }}>
                {meta.name}
              </div>
            </div>
          </div>
          <span className="chip" style={{ borderColor: `${meta.color}44` }}>
            locked
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <div className="tabular text-base font-semibold text-white">
              {member.streak}
            </div>
            <div className="text-[10px] text-muted">streak</div>
          </div>
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <div className="tabular text-base font-semibold text-white">
              {state?.season_tiles ?? 0}
            </div>
            <div className="text-[10px] text-muted">tiles</div>
          </div>
          <div className="rounded-lg bg-black/20 px-2 py-2">
            <div className="tabular text-base font-semibold text-white">
              {state?.win_streak ?? 0}
            </div>
            <div className="text-[10px] text-muted">win streak</div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Faction choice is permanent for this deployment. The map resets every
          season; your side does not.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Choose a side</div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Pick a faction. Keep it.
          </h3>
        </div>
        <span className="chip">one-time</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {FACTIONS.map((meta) => {
          const state = factions[meta.id];
          const active = selected === meta.id;
          return (
            <button
              key={meta.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(meta.id)}
              className={cn(
                "group rounded-xl border p-4 text-left transition",
                active
                  ? "bg-white/[0.05]"
                  : "border-line bg-black/20 hover:bg-white/[0.03]",
              )}
              style={{
                borderColor: active ? `${meta.color}88` : undefined,
                boxShadow: active ? `0 0 0 1px ${meta.color}44, 0 12px 40px -24px ${meta.color}` : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-4xl">{meta.emoji}</span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: meta.color }}
                >
                  {state?.total_wins ?? 0} wins
                </span>
              </div>
              <div
                className="mt-3 text-xl font-bold tracking-tight"
                style={{ color: meta.color }}
              >
                {meta.name}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted">
                {meta.tagline}
              </div>
              <div className="mt-3 flex items-center gap-3 font-mono text-[10px] text-muted">
                <span>{state?.season_tiles ?? 0} tiles</span>
                <span>·</span>
                <span>{state?.total_enlistments ?? 0} enlists</span>
              </div>
            </button>
          );
        })}
      </div>

      {!accountId ? (
        <button
          onClick={connect}
          disabled={connecting}
          className="btn btn-primary mt-3 w-full"
        >
          {connecting ? "Connecting…" : "Connect wallet to join"}
        </button>
      ) : (
        <button
          onClick={() => selected !== null && onJoin(selected)}
          disabled={selected === null || busy}
          className={cn(
            "btn mt-3 w-full",
            selected === 1 ? "btn-cats" : "btn-dogs",
          )}
        >
          {busy ? <Spinner /> : null}
          {selected === null
            ? "Select DOGS or CATS"
            : `Join ${FACTIONS[selected].name}`}
        </button>
      )}
      <p className="mt-2 text-center text-[10px] text-muted">
        Joining is permanent. You can enlist once per day after joining.
      </p>
    </div>
  );
}
