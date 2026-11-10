"use client";

import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import {
  CONTRACT_ID,
  NETWORK_ID,
  explorerAccountUrl,
} from "@/lib/contract";
import { compactUnits, formatUnits } from "@/lib/format";
import { Panel, Pill, SectionHeader, StatTile } from "@/components/ui";

const PRODUCTION = {
  day: "24 hours",
  season: "30 days",
  mint: "100,000 WAR / day",
  burn: "20% of the losing pool",
  underdog: "2.00× on the weaker side",
  coldLine: "3,750,000 WAR",
  coldBurn: "250,000 WAR",
  stake: "1,000 – 100,000 WAR",
  streak: "+5% per day, cap 2.00×",
  seasonBonus: "2% of treasury",
  claimWindow: "7 days",
};

function ParamRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] text-slate-300">{label}</div>
        {note ? (
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted">
            {note}
          </div>
        ) : null}
      </div>
      <div className="tabular shrink-0 font-mono text-[11px] text-gold">
        {value}
      </div>
    </div>
  );
}

export default function AboutPage() {
  const { snapshot } = useGame();
  const config = snapshot?.config;
  const decimals = config?.decimals ?? 24;
  const repoUrl = process.env.NEXT_PUBLIC_REPO_URL || "";

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>NEAR HACKATHON 2026</Pill>
          <Pill>TRACK 11 · MEMECOINS</Pill>
          <Pill>NEP-141</Pill>
          <Pill>THE JOKE NEEDS RULES</Pill>
        </div>
        <h1 className="display mt-5 text-4xl text-white sm:text-5xl">
          A MEMECOIN
          <br />
          <span className="gradient-text">WITH A MECHANIC.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
          Meme Wars is a two-faction war fought once a day. Players stake
          $WAR on DOGS or CATS; the winning side splits the day&apos;s mint,
          the losing side&apos;s stake is partially burned, and the winner
          captures a tile on a 25-cell map. After 30 days the faction holding
          the most tiles takes a slice of the treasury. Every parameter is set
          at launch and readable on-chain.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={explorerAccountUrl(CONTRACT_ID)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Open the contract
          </a>
          <Link href="/" className="btn btn-ghost">
            Enter the battle
          </Link>
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              Repository
            </a>
          ) : null}
        </div>
      </section>

      <section className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Network"
          value={NETWORK_ID}
          hint="testnet deployment"
        />
        <StatTile
          label="Contract"
          value={CONTRACT_ID.split(".")[0]}
          hint={CONTRACT_ID}
          tone="gold"
        />
        <StatTile
          label="Genesis supply"
          value={
            config
              ? `${compactUnits(config.genesis_supply, decimals)} WAR`
              : "…"
          }
          hint="fixed in new()"
        />
        <StatTile
          label="Demo day"
          value={config ? `${config.day_length_ns / 1_000_000_000}s` : "…"}
          hint="production: 24 hours"
          tone="mint"
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="p-5">
          <div className="eyebrow">Problem</div>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            A memecoin with only a price chart
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Most memecoins have no reason to come back tomorrow. There is no
            ritual, no team, no consequence, and the supply is usually a
            promise from a backend.
          </p>
        </Panel>
        <Panel className="p-5">
          <div className="eyebrow">Solution</div>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            A war you can verify
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            A NEP-141 token whose supply is a function of staking, winning and
            losing. Enlist once a day, build a streak, flip tiles, and watch
            the mint/burn ledger update on-chain.
          </p>
        </Panel>
        <Panel className="p-5">
          <div className="eyebrow">Why NEAR</div>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            Cheap enough to play daily
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Fast finality, low fees, human-readable accounts and a clean
            NEP-141/NEP-297 toolchain. The whole game is one Rust contract;
            there is no backend to switch off.
          </p>
        </Panel>
      </section>

      <section className="mt-4">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Hard requirements"
            title="What the judge can verify"
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4 font-mono font-normal uppercase tracking-[0.12em]">
                    Requirement
                  </th>
                  <th className="py-2 pr-4 font-mono font-normal uppercase tracking-[0.12em]">
                    Implementation
                  </th>
                  <th className="py-2 font-mono font-normal uppercase tracking-[0.12em]">
                    Evidence
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {[
                  [
                    "NEP-141 token",
                    "ft_transfer, ft_transfer_call, ft_balance_of, ft_total_supply, metadata, NEP-145 storage.",
                    "get_config / ft_metadata view; contract source; a transfer transaction.",
                  ],
                  [
                    "Mechanic on-chain",
                    "join_faction, enlist, settle_day, claims and seasons are contract methods. No backend.",
                    "get_log; event log; any testnet explorer page.",
                  ],
                  [
                    "Parameters fixed at launch",
                    "new(config) is the only initializer. No set_config, pause, upgrade or withdraw method.",
                    "get_config returns the same values forever; source search for setters is empty.",
                  ],
                  [
                    "Sybil resistance, limits disclosed",
                    "Stake cost, min/max stake, fixed daily pool, streak multiplier, underdog bonus, season power.",
                    "60-day simulation; README limitations; this page.",
                  ],
                  [
                    "Streak / progress / log page",
                    "Battle page shows the countdown, tug bar, streak strip, claims and the event log.",
                    "Connect a wallet and enlist; the log updates from get_log_tail.",
                  ],
                  [
                    "60-day simulation",
                    "sim/simulate.py, fixed seed, five scenarios, sensitivity runs, SVG charts.",
                    "sim/results/*.svg and summary.json, committed to the repository.",
                  ],
                ].map(([requirement, implementation, evidence]) => (
                  <tr
                    key={requirement}
                    className="border-b border-line/50 align-top last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium text-white">
                      {requirement}
                    </td>
                    <td className="py-3 pr-4 leading-relaxed text-muted">
                      {implementation}
                    </td>
                    <td className="py-3 leading-relaxed text-muted">
                      {evidence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <SectionHeader eyebrow="Mechanic" title="The math" />
          <div className="mt-4 space-y-3 font-mono text-[11px] leading-relaxed">
            {[
              ["power", "stake × (1 + min(streak, 20) × 5%)"],
              ["winner", "argmax(base power, weaker side × 2.00)"],
              ["burn", "losing stake × 20%"],
              ["reward_i", "daily mint × power_i ÷ winning base power"],
              ["season", "2% of treasury ÷ season power of the winning faction"],
            ].map(([label, formula]) => (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-lg border border-line/70 bg-black/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="uppercase tracking-[0.12em] text-muted">
                  {label}
                </span>
                <span className="text-gold">{formula}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            All amounts are integers; ratios use basis points. Settlement is
            O(1) over aggregate amounts, and each claim is O(1) over the
            player&apos;s own enlistment. The contract never iterates over all
            participants.
          </p>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Parameter ledger"
            title="This demo deployment"
            action={<Pill>from get_config</Pill>}
          />
          {config ? (
            <div className="mt-3">
              <ParamRow
                label="Day length"
                value={`${config.day_length_ns / 1_000_000_000}s`}
                note="Accelerated demo; production uses 86,400s."
              />
              <ParamRow label="Season" value={`${config.season_days} days`} />
              <ParamRow
                label="Daily mint pool"
                value={`${formatUnits(config.daily_mint_pool, decimals, 0)} WAR`}
              />
              <ParamRow
                label="Loss burn"
                value={`${config.loss_burn_bp / 100}%`}
              />
              <ParamRow
                label="Underdog bonus"
                value={`${(config.underdog_bonus_bp / 10_000).toFixed(2)}×`}
                note="Applied to the weaker side's base power at settlement."
              />
              <ParamRow
                label="Cold line / burn"
                value={`${formatUnits(config.cold_line, decimals, 0)} / ${formatUnits(config.cold_burn, decimals, 0)} WAR`}
              />
              <ParamRow
                label="Stake range"
                value={`${formatUnits(config.min_stake, decimals, 0)} – ${formatUnits(config.max_stake_per_day, decimals, 0)} WAR`}
              />
              <ParamRow
                label="Streak"
                value={`+${config.streak_step_bp / 100}% / day · cap ×${(1 + (config.streak_cap_days * config.streak_step_bp) / 10_000).toFixed(2)}`}
              />
              <ParamRow
                label="Season bonus"
                value={`${config.season_bonus_bp / 100}% of treasury`}
              />
              <ParamRow
                label="Claim window"
                value={`${config.claim_window_days} days`}
                note="Unclaimed rewards can be closed; stakes never expire."
              />
              <ParamRow
                label="Demo faucet"
                value={
                  config.demo_mode
                    ? `${formatUnits(config.demo_faucet_amount, decimals, 0)} WAR / account`
                    : "disabled"
                }
              />
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted">
              Reading parameters from the contract…
            </p>
          )}
        </Panel>
      </section>

      <section className="mt-4">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="The production recipe"
            title="What the simulation chose"
            action={<Pill>60 days · seed 42</Pill>}
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <ParamRow label="Day" value={PRODUCTION.day} />
              <ParamRow label="Season" value={PRODUCTION.season} />
              <ParamRow label="Daily mint" value={PRODUCTION.mint} />
              <ParamRow label="Loss burn" value={PRODUCTION.burn} />
              <ParamRow label="Underdog" value={PRODUCTION.underdog} />
              <ParamRow label="Cold line" value={PRODUCTION.coldLine} />
              <ParamRow label="Cold burn" value={PRODUCTION.coldBurn} />
              <ParamRow label="Stake" value={PRODUCTION.stake} />
              <ParamRow label="Streak" value={PRODUCTION.streak} />
              <ParamRow label="Season bonus" value={PRODUCTION.seasonBonus} />
              <ParamRow label="Claim window" value={PRODUCTION.claimWindow} />
            </div>
            <div className="space-y-2.5 text-[11px] leading-relaxed text-muted">
              <p>
                The daily mint is deliberately small relative to total supply
                (100k WAR/day on a 1B genesis = 0.01%/day). The losing-side
                burn is larger than the mint in the balanced scenario, so the
                supply is a <span className="text-dogs">sink</span>, not a
                faucet: −1.90% over 60 days in the committed run, and worse
                when turnout is cold.
              </p>
              <p>
                The 2.00× underdog bonus is the maximum allowed by the config.
                It reduces a 70/30 player split from a 100% sweep to roughly
                80/20 day wins in the stress test, but it cannot make an
                extremely lopsided community fair. That limitation is
                disclosed rather than hidden.
              </p>
              <p>
                The season bonus is 2% of the remaining treasury, split by
                season power among the faction that owns the most tiles on the
                final map. It is the long-horizon prize; the daily mint is the
                rhythm.
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="mt-4">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="60-day simulation"
            title="Supply, treasury, turnout"
            action={<Pill>python3 sim/simulate.py</Pill>}
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[
              ["supply.svg", "Total supply under five scenarios"],
              ["treasury.svg", "Treasury balance over time"],
              ["cold_days.svg", "Cold days per scenario"],
              ["win_rates.svg", "Day outcomes by scenario"],
              ["sybil_roi.svg", "Sybil raid: return on staked capital"],
              ["sensitivity.svg", "Parameter sensitivity: final supply"],
            ].map(([file, alt]) => (
              <figure
                key={file}
                className="overflow-hidden rounded-xl border border-line bg-black/20"
              >
                <img
                  src={`/sim/${file}`}
                  alt={alt}
                  className="w-full"
                  loading="lazy"
                />
                <figcaption className="border-t border-line/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  {alt}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Balanced supply"
              value="−1.90%"
              hint="60 days; annualized −11.6%"
              tone="dogs"
            />
            <StatTile
              label="Cold days"
              value="4 / 60"
              hint="balanced scenario"
              tone="gold"
            />
            <StatTile
              label="Day win split"
              value="36.7 / 56.7"
              hint="DOGS / CATS, balanced"
              tone="cats"
            />
            <StatTile
              label="Sybil ROI"
              value="−1.42%"
              hint="committed seed; −4.52% mean over 30 seeds"
              tone="mint"
            />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">
            Fixed seed 42, pure standard library, reproducible with{" "}
            <span className="font-mono text-slate-300">
              python3 sim/simulate.py
            </span>
            . The 30-seed robustness run behind the sybil number is documented
            in <span className="font-mono">docs/PARAMS.md</span>.
          </p>
        </Panel>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Sybil resistance"
            title="What is actually enforced"
          />
          <ul className="mt-4 space-y-2.5 text-[11px] leading-relaxed text-muted">
            {[
              "Every enlistment locks real WAR; the losing side burns 20% of its stake.",
              "A per-account daily maximum caps how much one wallet can move the day.",
              "The daily mint is fixed. More accounts do not create more rewards; they split the same pool.",
              "The streak multiplier starts at 1.05× and takes 20 consecutive days to reach 2.00×. Fresh accounts start behind.",
              "The weaker faction gets a 2.00× underdog bonus in production, so adding accounts to the larger side does not automatically buy the day.",
              "Season power is proportional to stake × streak, not headcount. Minimum-stake sock puppets earn minimum shares.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionHeader eyebrow="Honest limits" title="What it does not do" />
          <ul className="mt-4 space-y-2.5 text-[11px] leading-relaxed text-muted">
            {[
              "A chain cannot tell whether 30 accounts belong to one person. These mechanisms raise the cost and dilute the payout; they do not prove personhood.",
              "Sybils can hedge both factions. The losing side still pays the burn, so it is not risk-free, but it can smooth outcomes.",
              "A capital-rich player can still move a day. The daily cap limits one account; it does not limit many funded accounts.",
              "The MVP has no faction switching. An extreme 70/30 player split still favors the majority; the simulation shows roughly 80/20 day wins. The season/map reset limits long-term lock-in, not daily math.",
              "The demo faucet exists only in demo_mode. The production recipe has no free tokens; staking costs real balance.",
              "Sybil ROI is negative on average in the simulation (−4.52% over 30 seeds), but individual seeds can be positive. It is a deterrent, not a guarantee.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="mt-4">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Partners"
            title="Explored, not faked"
            action={<Pill>core has zero partner dependencies</Pill>}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "meme.cooking",
                "explored, not integrated",
                "The mechanic needs native mint/burn, so the demo uses a self-deployed NEP-141. A launchpad import can be added without changing the contract.",
              ],
              [
                "NEAR Intents",
                "explored, not integrated",
                "Cross-chain buy flow is a frontend adapter. The MVP is testnet-only and the 1Click API has no testnet, so no fake swap is shown.",
              ],
              [
                "HOT",
                "explored, not integrated",
                "Wallet Selector with MyNearWallet and Meteor is the current onboarding path. HOT can be added as another module.",
              ],
              [
                "Rhea",
                "explored, not integrated",
                "No mainnet liquidity was created for this testnet demo. A production launch can point the buy button at a Rhea/Ref pool.",
              ],
              [
                "NEAR.AI / BRRRAIN",
                "not shipped in MVP",
                "A War Prophet analyst can be built off-chain; it would be a player, not an admin. Nothing in the game depends on it.",
              ],
              [
                "Trezu / SputnikDAO",
                "ops only",
                "Optional community/ops treasury tooling. It never controls game parameters or the contract treasury.",
              ],
            ].map(([name, status, note]) => (
              <div
                key={name}
                className="rounded-xl border border-line/70 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-white">
                    {name}
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">
                    {status}
                  </span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted">
                  {note}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">
            No partner can pause the game, change a parameter or withdraw the
            treasury. Partner outages cannot affect enlist, settle or claim.
          </p>
        </Panel>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <SectionHeader eyebrow="Trust surface" title="What is deployed" />
          <div className="mt-4 space-y-3 text-[11px] leading-relaxed text-muted">
            <p>
              Contract:{" "}
              <a
                href={explorerAccountUrl(CONTRACT_ID)}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-gold hover:underline"
              >
                {CONTRACT_ID}
              </a>
            </p>
            <p>
              There is no admin method: no <span className="font-mono">set_config</span>,
              no <span className="font-mono">pause</span>, no{" "}
              <span className="font-mono">upgrade</span>, no{" "}
              <span className="font-mono">withdraw_treasury</span>. Parameters
              live only in the constructor. The contract account has a
              deployer key during the hackathon for testnet iteration; the
              production checklist removes every full-access key after deploy
              and records the transaction.
            </p>
            <p>
              The contract keeps a bounded 200-entry event log and emits
              NEP-297 <span className="font-mono">EVENT_JSON</span> for every
              mint, burn, capture and claim.
            </p>
            <p>
              This demo is testnet only. Tokens have no monetary value. Do not
              send mainnet funds.
            </p>
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Five-minute acceptance path"
            title="Do X, see Y"
          />
          <ol className="mt-4 space-y-2.5 text-[11px] leading-relaxed text-muted">
            {[
              "Connect a testnet wallet.",
              "Pick DOGS or CATS. The join transaction registers storage and, when the faucet is eligible, claims 100,000 test WAR in the same batch.",
              "Enlist 1,000 WAR; the tug bar, your locked stake and the streak strip update.",
              "Wait for the 60-second day to end and click Settle; a winner, a mint/burn row and a map tile appear.",
              "Claim the stake + reward; your balance and the ledger update.",
              "Open Map and Season; the tile and the season progress are live.",
              "Run python3 sim/simulate.py; open sim/results/supply.svg.",
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-black/30 font-mono text-[9px] text-gold">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/" className="btn btn-primary !py-2">
              Start at the battle
            </Link>
            <Link href="/log" className="btn btn-ghost !py-2">
              Read the ledger
            </Link>
          </div>
        </Panel>
      </section>

      <section className="mt-10 rounded-2xl border border-line/70 bg-gradient-to-r from-dogs/[0.06] via-transparent to-cats/[0.06] p-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Built at NEAR HACKATHON · 2026
        </div>
        <div className="mt-2 text-lg font-semibold text-white">
          The joke needs rules.
        </div>
        <div className="mt-1 text-xs text-muted">
          Meme Wars · {CONTRACT_ID} · {NETWORK_ID}
        </div>
      </section>
    </>
  );
}
