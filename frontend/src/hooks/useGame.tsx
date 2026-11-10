"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CONTRACT_ID,
  view,
  viewBatch,
  type ClaimItem,
  type ClockInfo,
  type Config,
  type DayState,
  type Enlistment,
  type EnlistmentAt,
  type FactionState,
  type FaucetState,
  type LogEntry,
  type Member,
  type SeasonPlayer,
  type SeasonState,
  type Stats,
} from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { fc, type NearAction } from "@/lib/actions";
import { useToast } from "@/components/Toast";

export interface GameSnapshot {
  clock: ClockInfo;
  config: Config;
  stats: Stats;
  factions: FactionState[];
  currentDayState: DayState | null;
  lastDayState: DayState | null;
  map: number[];
  log: LogEntry[];
  season: SeasonState | null;
  seasons: SeasonState[];
  latestSeason: SeasonState | null;
  member: Member | null;
  balance: string;
  faucet: FaucetState | null;
  claims: ClaimItem[];
  seasonPlayer: SeasonPlayer | null;
  latestSeasonPlayer: SeasonPlayer | null;
  todayEnlistment: Enlistment | null;
  recentEnlistments: EnlistmentAt[];
  fetchedAt: number;
}

interface GameContextValue {
  snapshot: GameSnapshot | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  refresh: () => void;
  execute: (
    actions: NearAction[],
    successMessage?: string,
  ) => Promise<boolean>;
  executeOne: (
    methodName: string,
    args?: Record<string, unknown>,
    options?: { gas?: string; deposit?: string },
    successMessage?: string,
  ) => Promise<boolean>;
}

const GameContext = createContext<GameContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Transaction failed";
  }
}

// Immutable and slow-moving views are cached for the session / a few seconds.
// The public RPC rate-limits; this keeps one open tab at a polite rate.
let configCache: Config | null = null;
let seasonsCache:
  | { at: number; season: number; data: SeasonState[] }
  | null = null;

async function loadSnapshot(accountId: string | null): Promise<GameSnapshot> {
  const firstCalls: Array<{
    method: string;
    args?: Record<string, unknown>;
  }> = [
    { method: "get_clock" },
    { method: "get_stats" },
    { method: "get_factions" },
    { method: "get_map" },
    { method: "get_log_tail", args: { limit: 40 } },
  ];
  if (!configCache) firstCalls.push({ method: "get_config" });

  const first = await viewBatch(firstCalls);
  const clock = first[0] as ClockInfo;
  const stats = first[1] as Stats;
  const factions = first[2] as FactionState[];
  const map = first[3] as number[];
  const log = first[4] as LogEntry[];
  const config = configCache ?? (first[5] as Config);
  configCache = config;

  const fromDay = Math.max(1, clock.current_day - 21);
  const includeSeasons =
    !seasonsCache ||
    Date.now() - seasonsCache.at > 30_000 ||
    seasonsCache.season !== clock.current_season;

  const secondCalls: Array<{ method: string; args?: Record<string, unknown> }> = [
    { method: "get_day", args: { day: clock.current_day } },
    { method: "get_season", args: { season: clock.current_season } },
  ];
  if (includeSeasons) {
    secondCalls.push({
      method: "get_seasons",
      args: { from: 1, to: clock.current_season },
    });
  }
  if (clock.last_settled_day > 0) {
    secondCalls.push({
      method: "get_day",
      args: { day: clock.last_settled_day },
    });
  }
  if (accountId) {
    secondCalls.push(
      { method: "get_member", args: { account_id: accountId } },
      { method: "ft_balance_of", args: { account_id: accountId } },
      { method: "get_faucet_state", args: { account_id: accountId } },
      {
        method: "get_claims",
        args: {
          account_id: accountId,
          from_day: fromDay,
          to_day: clock.current_day,
        },
      },
      {
        method: "get_season_player",
        args: { season: clock.current_season, account_id: accountId },
      },
      {
        method: "get_enlistment",
        args: { day: clock.current_day, account_id: accountId },
      },
      {
        method: "get_enlistments",
        args: {
          account_id: accountId,
          from_day: Math.max(1, clock.current_day - 6),
          limit: 7,
        },
      },
    );
  }

  const second = await viewBatch(secondCalls);
  let cursor = 0;
  const currentDayState = second[cursor++] as DayState | null;
  const season = second[cursor++] as SeasonState | null;
  let seasons: SeasonState[];
  if (includeSeasons) {
    seasons = ((second[cursor++] as SeasonState[]) ?? []).slice();
    seasonsCache = {
      at: Date.now(),
      season: clock.current_season,
      data: seasons,
    };
  } else {
    seasons = seasonsCache!.data;
  }
  const lastDayState =
    clock.last_settled_day > 0
      ? (second[cursor++] as DayState | null)
      : null;
  const latestSeason = [...seasons]
    .filter((state) => state.settled)
    .sort((a, b) => b.season - a.season)[0] ?? null;

  let member: Member | null = null;
  let balance = "0";
  let faucet: FaucetState | null = null;
  let claims: ClaimItem[] = [];
  let seasonPlayer: SeasonPlayer | null = null;
  let latestSeasonPlayer: SeasonPlayer | null = null;
  let todayEnlistment: Enlistment | null = null;
  let recentEnlistments: EnlistmentAt[] = [];

  if (accountId) {
    member = second[cursor++] as Member | null;
    balance = (second[cursor++] as string) ?? "0";
    faucet = second[cursor++] as FaucetState;
    claims = (second[cursor++] as ClaimItem[]) ?? [];
    seasonPlayer = second[cursor++] as SeasonPlayer;
    todayEnlistment = second[cursor++] as Enlistment | null;
    recentEnlistments = (second[cursor++] as EnlistmentAt[]) ?? [];
  }

  if (accountId && latestSeason) {
    if (latestSeason.season === clock.current_season) {
      latestSeasonPlayer = seasonPlayer;
    } else if (!latestSeason.rewards_closed) {
      try {
        latestSeasonPlayer = await view<SeasonPlayer>("get_season_player", {
          season: latestSeason.season,
          account_id: accountId,
        });
      } catch {
        latestSeasonPlayer = null;
      }
    }
  }

  return {
    clock,
    config,
    stats,
    factions,
    currentDayState,
    lastDayState,
    map,
    log,
    season,
    seasons: [...seasons].sort((a, b) => b.season - a.season),
    latestSeason,
    member,
    balance,
    faucet,
    claims,
    seasonPlayer,
    latestSeasonPlayer,
    todayEnlistment,
    recentEnlistments,
    fetchedAt: Date.now(),
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { accountId, send } = useWallet();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const next = await loadSnapshot(accountId);
        if (!alive) return;
        setSnapshot(next);
        setError(null);
      } catch (fetchError) {
        if (!alive) return;
        setError(errorMessage(fetchError));
      } finally {
        if (!alive) return;
        setLoading(false);
        timer = setTimeout(tick, 8000);
      }
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [accountId, refreshKey]);

  const execute = useCallback(
    async (actions: NearAction[], successMessage?: string) => {
      if (!accountId) {
        toast.error("Connect a NEAR wallet first.");
        return false;
      }
      setBusy(true);
      try {
        await send(actions);
        if (successMessage) toast.success(successMessage);
        await new Promise((resolve) => setTimeout(resolve, 1400));
        refresh();
        return true;
      } catch (transactionError) {
        toast.error(errorMessage(transactionError));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accountId, send, toast, refresh],
  );

  const executeOne = useCallback(
    (
      methodName: string,
      args: Record<string, unknown> = {},
      options: { gas?: string; deposit?: string } = {},
      successMessage?: string,
    ) => execute([fc(methodName, args, options)], successMessage),
    [execute],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      snapshot,
      loading,
      error,
      busy,
      refresh,
      execute,
      executeOne,
    }),
    [snapshot, loading, error, busy, refresh, execute, executeOne],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
}

export const CONTRACT = CONTRACT_ID;
