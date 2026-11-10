"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/", label: "Battle" },
  { href: "/map", label: "Map" },
  { href: "/season", label: "Season" },
  { href: "/log", label: "Log" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-line bg-panel">
            <span className="absolute inset-y-0 left-0 w-1/2 bg-dogs/20" />
            <span className="absolute inset-y-0 right-0 w-1/2 bg-cats/20" />
            <span className="relative font-mono text-[10px] font-bold tracking-tighter text-white">
              MW
            </span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-extrabold tracking-[0.02em] text-white">
              MEME WARS
            </span>
            <span className="mt-1 font-mono text-[9px] tracking-[0.22em] text-muted">
              $WAR · TESTNET
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-white/[0.06] text-white"
                    : "text-muted hover:bg-white/[0.04] hover:text-slate-200",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <WalletButton />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs transition",
                active
                  ? "bg-white/[0.07] text-white"
                  : "text-muted hover:text-slate-200",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
