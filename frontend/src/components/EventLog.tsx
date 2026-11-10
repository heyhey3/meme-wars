"use client";

import Link from "next/link";
import {
  FACTIONS,
  parseEventData,
  type Config,
  type LogEntry,
} from "@/lib/contract";
import { formatUnits, shortAccount, cn } from "@/lib/format";

type Tone = "dogs" | "cats" | "gold" | "mint" | "muted";

function asString(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";
}

function eventInfo(
  entry: LogEntry,
  config: Config,
): { title: string; detail?: string; tone: Tone } {
  const data = parseEventData(entry);
  const decimals = config.decimals;
  const amount = entry.amount
    ? formatUnits(entry.amount, decimals, 0)
    : "";
  const faction =
    entry.faction !== null ? FACTIONS[entry.faction]?.name : "";
  const who = entry.account ? shortAccount(entry.account) : "";

  switch (entry.event) {
    case "enlist": {
      const streak = asString(data.streak);
      const mult = Number(asString(data.multiplier_bp)) / 10_000;
      const power = asString(data.power);
      return {
        title: `${who} enlisted ${amount} WAR`,
        detail: `day ${entry.day} · streak ${streak} · ×${mult.toFixed(2)} → ${
          power ? formatUnits(power, decimals, 0) : "?"
        } power`,
        tone: entry.faction === 0 ? "dogs" : "cats",
      };
    }
    case "day_settled": {
      const cold = data.cold === true;
      const winner = data.winner;
      const winnerName =
        typeof winner === "number" ? FACTIONS[winner]?.name : null;
      const burned = asString(data.burned);
      const reward = asString(data.reward_pool);
      return {
        title: cold
          ? `Day ${entry.day} was cold`
          : winnerName
            ? `Day ${entry.day}: ${winnerName} won`
            : `Day ${entry.day} ended in a tie`,
        detail: `${reward ? formatUnits(reward, decimals, 0) : "0"} minted · ${
          burned ? formatUnits(burned, decimals, 0) : "0"
        } burned`,
        tone: cold
          ? "gold"
          : typeof winner === "number"
            ? winner === 0
              ? "dogs"
              : "cats"
            : "muted",
      };
    }
    case "reward_mint":
      return {
        title: `+${amount} WAR minted`,
        detail: `day ${entry.day} reward vault`,
        tone: "mint",
      };
    case "stake_burn":
      return {
        title: `-${amount} WAR burned`,
        detail: `day ${entry.day} · ${faction || "losing"} stakes`,
        tone: "dogs",
      };
    case "cold_day":
      return {
        title: `Cold day: ${amount} WAR burned`,
        detail: `day ${entry.day} · treasury paid for the silence`,
        tone: "gold",
      };
    case "map_capture":
      return {
        title: `${faction || "?"} captured tile #${asString(data.tile)}`,
        detail: `day ${entry.day}`,
        tone: entry.faction === 0 ? "dogs" : "cats",
      };
    case "stake_claim":
      return {
        title: `${who} reclaimed ${amount} WAR`,
        detail: `day ${entry.day} stake`,
        tone: "mint",
      };
    case "reward_claim":
      return {
        title: `${who} claimed ${amount} WAR`,
        detail: `day ${entry.day} reward`,
        tone: "mint",
      };
    case "join_faction":
      return {
        title: `${who} joined ${faction || "a faction"}`,
        detail: `day ${entry.day}`,
        tone: entry.faction === 0 ? "dogs" : "cats",
      };
    case "faucet_claim":
      return {
        title: `${who} got ${amount} test WAR`,
        detail: `demo faucet · day ${entry.day}`,
        tone: "gold",
      };
    case "season_end": {
      const winner = data.winner;
      const winnerName =
        typeof winner === "number" ? FACTIONS[winner]?.name : null;
      return {
        title: `Season ${asString(data.season)} ended — ${
          winnerName ?? "tie"
        }`,
        detail: `${amount} WAR season bonus · tiles ${asString(data.tiles)}`,
        tone: "gold",
      };
    }
    case "season_claim":
      return {
        title: `${who} claimed ${amount} WAR`,
        detail: `season ${asString(data.season)} bonus`,
        tone: "gold",
      };
    case "claims_closed":
      return {
        title: `${amount} WAR unclaimed rewards burned`,
        detail: `day ${entry.day} window closed`,
        tone: "muted",
      };
    case "season_claims_closed":
      return {
        title: `${amount} WAR unclaimed season bonus burned`,
        detail: `season ${asString(data.season)} window closed`,
        tone: "muted",
      };
    default:
      return {
        title: entry.event.replaceAll("_", " "),
        detail: `day ${entry.day}`,
        tone: "muted",
      };
  }
}

const TONE_DOT: Record<Tone, string> = {
  dogs: "bg-dogs",
  cats: "bg-cats",
  gold: "bg-gold",
  mint: "bg-mint",
  muted: "bg-slate-500",
};

export function EventLog({
  log,
  config,
  limit = 12,
  showLink = false,
}: {
  log: LogEntry[];
  config: Config;
  limit?: number;
  showLink?: boolean;
}) {
  const entries = [...log].reverse().slice(0, limit);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">War log</div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Every mint, burn and claim
          </h3>
        </div>
        {showLink ? (
          <Link
            href="/log"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-gold"
          >
            full log →
          </Link>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-center text-[11px] text-muted">
          No events yet. The first enlistment writes the first line.
        </p>
      ) : (
        <div className="mt-3 space-y-0.5">
          {entries.map((entry) => {
            const info = eventInfo(entry, config);
            return (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/[0.025]"
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    TONE_DOT[info.tone],
                  )}
                />
                <div className="min-w-0">
                  <div className="text-[11px] leading-snug text-slate-200">
                    {info.title}
                  </div>
                  {info.detail ? (
                    <div className="mt-0.5 truncate font-mono text-[9px] text-muted">
                      {info.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
