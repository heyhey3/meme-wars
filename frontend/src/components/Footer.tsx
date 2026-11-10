import Link from "next/link";
import {
  CONTRACT_ID,
  NETWORK_ID,
  explorerAccountUrl,
} from "@/lib/contract";

export function Footer() {
  const repoUrl = process.env.NEXT_PUBLIC_REPO_URL || "";

  return (
    <footer className="mt-20 border-t border-line/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="text-sm font-extrabold tracking-[0.02em] text-white">
            MEME WARS
          </div>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
            A two-faction memecoin where the supply reacts to what the
            community does. Built at NEAR HACKATHON 2026.
          </p>
          <div className="mt-3 inline-flex rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {NETWORK_ID} · testnet only
          </div>
        </div>

        <div>
          <div className="eyebrow">Contract</div>
          <a
            href={explorerAccountUrl(CONTRACT_ID)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-mono text-xs text-slate-300 hover:text-gold"
          >
            {CONTRACT_ID}
          </a>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            No admin, no pause, no upgrade method. Parameters live in{" "}
            <span className="font-mono">new()</span>.
          </p>
        </div>

        <div>
          <div className="eyebrow">Explore</div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
            <Link href="/about" className="hover:text-gold">
              Rules
            </Link>
            <Link href="/season" className="hover:text-gold">
              Seasons
            </Link>
            <Link href="/log" className="hover:text-gold">
              Event log
            </Link>
            {repoUrl ? (
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-gold"
              >
                Repository
              </a>
            ) : null}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Testnet demo. Tokens have no monetary value. Play the mechanic, not
            the chart.
          </p>
        </div>
      </div>
      <div className="border-t border-line/60 px-4 py-4 text-center font-mono text-[10px] tracking-[0.12em] text-muted sm:px-6">
        BUILT AT NEAR HACKATHON · TRACK: MEMECOINS WITH MECHANICS · THE JOKE
        NEEDS RULES
      </div>
    </footer>
  );
}
