"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { shortAccount } from "@/lib/format";
import { useToast } from "./Toast";
import { Skeleton } from "./ui";

export function WalletButton() {
  const {
    accountId,
    initializing,
    connecting,
    connect,
    disconnect,
  } = useWallet();
  const toast = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  if (initializing) {
    return <Skeleton className="h-9 w-32 rounded-xl" />;
  }

  if (!accountId) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="btn btn-primary !py-2.5"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M4 9h13.5A1.5 1.5 0 0 1 19 10.5v3A1.5 1.5 0 0 1 17.5 15H4"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="16" cy="12.5" r="1" fill="currentColor" />
        </svg>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      toast.success("Address copied");
    } catch {
      toast.error("Could not copy the address");
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect();
      toast.info("Wallet disconnected");
    } catch {
      toast.error("Could not disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <details className="relative z-50">
      <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel-2/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500/60">
        <span className="live-dot" />
        <span className="font-mono text-xs">{shortAccount(accountId)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-[#0b1321] p-2 shadow-2xl">
        <div className="px-2 py-1.5">
          <div className="eyebrow">Signed in</div>
          <div className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate-300">
            {accountId}
          </div>
        </div>
        <button
          onClick={copyAccount}
          className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
        >
          Copy address
        </button>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="w-full rounded-lg px-2 py-2 text-left text-sm text-dogs hover:bg-dogs/10 disabled:opacity-50"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    </details>
  );
}
