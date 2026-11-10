"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WalletSelector } from "@near-wallet-selector/core";
import { setupWalletSelector } from "@near-wallet-selector/core";
import {
  setupModal,
  type WalletSelectorModal,
} from "@near-wallet-selector/modal-ui";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { CONTRACT_ID, EXPLORER_URL, NETWORK_ID, RPC_URL } from "./contract";
import { fc, type NearAction } from "./actions";

interface WalletContextValue {
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  accountId: string | null;
  initializing: boolean;
  connecting: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  send: (actions: NearAction[]) => Promise<unknown>;
  call: (
    methodName: string,
    args?: Record<string, unknown>,
    options?: { gas?: string; deposit?: string },
  ) => Promise<unknown>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Kept outside React so Strict Mode / Fast Refresh does not create duplicate
// wallet-selector instances or duplicate modals.
let selectorPromise: Promise<WalletSelector> | null = null;
let modalCache: WalletSelectorModal | null = null;

function getSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    const isMainnet = NETWORK_ID === "mainnet";
    selectorPromise = setupWalletSelector({
      network: {
        networkId: NETWORK_ID,
        nodeUrl: RPC_URL,
        helperUrl: isMainnet
          ? "https://helper.near.org"
          : "https://helper.testnet.near.org",
        explorerUrl: EXPLORER_URL,
        indexerUrl: isMainnet
          ? "https://api.kitwallet.app"
          : "https://testnet-api.kitwallet.app",
      },
      modules: [setupMyNearWallet(), setupMeteorWallet()],
      allowMultipleSelectors: true,
    });
  }
  return selectorPromise;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSelector()
      .then((instance) => {
        if (cancelled) return;
        setSelector(instance);
        setAccountId(
          instance.store.getState().accounts[0]?.accountId ?? null,
        );

        if (!modalCache) {
          modalCache = setupModal(instance, {
            contractId: CONTRACT_ID,
            theme: "dark",
            description: "Pick a side. Stake. Let the map remember.",
          });
        }
        const modalInstance = modalCache;
        setModal(modalInstance);

        const hideSubscription = modalInstance.on("onHide", () => {
          setConnecting(false);
        });
        const stateSubscription = instance.store.observable.subscribe(
          (state) => {
            setAccountId(state.accounts[0]?.accountId ?? null);
            if (state.accounts.length > 0) setConnecting(false);
          },
        );

        cleanupRef.current = () => {
          hideSubscription.remove();
          stateSubscription.unsubscribe();
        };
      })
      .catch((error) => {
        console.error("wallet selector setup failed", error);
        setConnecting(false);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const connect = useCallback(() => {
    if (!modal) return;
    setConnecting(true);
    modal.show();
  }, [modal]);

  const disconnect = useCallback(async () => {
    if (!selector) return;
    const wallet = await selector.wallet();
    await wallet.signOut();
    setAccountId(null);
  }, [selector]);

  const send = useCallback(
    async (actions: NearAction[]) => {
      if (!selector || !accountId) throw new Error("Connect a wallet first");
      const wallet = await selector.wallet();
      return wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: CONTRACT_ID,
        actions,
      });
    },
    [selector, accountId],
  );

  const call = useCallback(
    (
      methodName: string,
      args: Record<string, unknown> = {},
      options: { gas?: string; deposit?: string } = {},
    ) => send([fc(methodName, args, options)]),
    [send],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      selector,
      modal,
      accountId,
      initializing,
      connecting,
      connect,
      disconnect,
      send,
      call,
    }),
    [
      selector,
      modal,
      accountId,
      initializing,
      connecting,
      connect,
      disconnect,
      send,
      call,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
