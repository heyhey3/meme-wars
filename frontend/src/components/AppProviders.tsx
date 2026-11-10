"use client";

import type { ReactNode } from "react";
import { WalletProvider } from "@/lib/wallet";
import { GameProvider } from "@/hooks/useGame";
import { ToastProvider } from "./Toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>
        <GameProvider>{children}</GameProvider>
      </WalletProvider>
    </ToastProvider>
  );
}
