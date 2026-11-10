"use client";

import { useGame } from "@/hooks/useGame";
import { useWallet } from "@/lib/wallet";
import {
  GAS_30,
  GAS_60,
  STORAGE_DEPOSIT,
  canClaimFaucet,
} from "@/lib/contract";
import { fc } from "@/lib/actions";
import { cn } from "@/lib/format";
import { Spinner } from "./ui";

export function FaucetButton({
  className,
  label = "Get test WAR",
}: {
  className?: string;
  label?: string;
}) {
  const { snapshot, busy, execute } = useGame();
  const { accountId, connect, connecting } = useWallet();

  if (!snapshot?.config.demo_mode) return null;

  if (!accountId) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className={cn("btn btn-ghost", className)}
      >
        {connecting ? "Connecting…" : "Connect to get test WAR"}
      </button>
    );
  }

  const faucet = snapshot.faucet;
  if (!faucet) return null;
  if (faucet.claimed) {
    return (
      <span className={cn("chip", className)}>
        Test WAR claimed
      </span>
    );
  }
  if (!canClaimFaucet(faucet)) {
    return (
      <span className={cn("chip", className)}>
        Faucet unavailable
      </span>
    );
  }

  const claim = async () => {
    const actions = [];
    if (!faucet.registered) {
      actions.push(
        fc(
          "storage_deposit",
          { account_id: accountId, registration_only: true },
          { gas: GAS_60, deposit: STORAGE_DEPOSIT },
        ),
      );
    }
    actions.push(fc("claim_faucet", {}, { gas: GAS_30 }));
    await execute(actions, "Test WAR claimed. Time to pick a side.");
  };

  return (
    <button
      onClick={claim}
      disabled={busy}
      className={cn("btn btn-primary", className)}
    >
      {busy ? <Spinner /> : null}
      {label}
    </button>
  );
}
