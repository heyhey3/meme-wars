import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function Panel({
  children,
  className,
  flat = false,
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
}) {
  return (
    <div className={cn(flat ? "panel-flat" : "panel", className)}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("chip", className)}>{children}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "dogs" | "cats" | "gold" | "mint";
}) {
  const valueColor =
    tone === "dogs"
      ? "text-dogs"
      : tone === "cats"
        ? "text-cats"
        : tone === "gold"
          ? "text-gold"
          : tone === "mint"
            ? "text-mint"
            : "text-white";
  return (
    <div className="panel-flat px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={cn("tabular mt-1 text-xl font-semibold", valueColor)}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <div className="text-sm font-medium text-slate-300">{title}</div>
      {children ? (
        <div className="mt-1 text-xs leading-relaxed text-muted">{children}</div>
      ) : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
