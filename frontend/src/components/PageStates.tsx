"use client";

import { Skeleton } from "./ui";

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-14 w-full max-w-2xl" />
        <Skeleton className="h-14 w-full max-w-xl" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    </div>
  );
}

export function ErrorPanel({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="panel mx-auto max-w-lg p-6 text-center">
      <div className="text-2xl" aria-hidden>
        📡
      </div>
      <h1 className="mt-3 text-lg font-semibold text-white">
        Could not reach the testnet RPC
      </h1>
      <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-muted">
        {error}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        The contract is live on testnet. Check the network and try again.
      </p>
      <button onClick={onRetry} className="btn btn-primary mt-4">
        Retry
      </button>
    </div>
  );
}
