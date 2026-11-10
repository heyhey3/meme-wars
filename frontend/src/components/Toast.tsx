"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/format";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastApi {
  push: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (text: string, kind: ToastKind = "info") => {
      const id = ++idRef.current;
      setItems((current) => [...current.slice(-3), { id, text, kind }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (text: string) => push(text, "success"),
      error: (text: string) => push(text, "error"),
      info: (text: string) => push(text, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => dismiss(item.id)}
            className={cn(
              "pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-left text-sm shadow-2xl backdrop-blur",
              item.kind === "success" &&
                "border-mint/40 bg-mint/10 text-mint",
              item.kind === "error" && "border-dogs/40 bg-dogs/10 text-dogs",
              item.kind === "info" && "border-line bg-panel/95 text-slate-200",
            )}
          >
            {item.text}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
