/**
 * Demo keeper.
 *
 * Every ~15 seconds it:
 *   1. settles finished days (permissionless),
 *   2. claims each demo account's settled stake/reward,
 *   3. re-enlists both demo accounts for the new day.
 *
 * This is demo automation, not part of the contract. The core game works
 * without it: any wallet can call settle_day, and enlist auto-settles up to
 * seven overdue days.
 */
import {
  CONTRACT_ID,
  DEMO_ACCOUNTS,
  MIN_STAKE,
  asWar,
  call,
  connectNear,
  view,
} from "./lib.mjs";

const SETTLE_GAS = "100000000000000";
const PRIMARY_STAKE = 100_000n * 10n ** 24n;
const SECONDARY_STAKE = 80_000n * 10n ** 24n;
const accounts = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function accountFor(near, accountId) {
  if (!accounts.has(accountId)) {
    accounts.set(accountId, await near.account(accountId));
  }
  return accounts.get(accountId);
}

async function settleOverdue(near) {
  const clock = await view(near, "get_clock");
  const lastFinished = clock.current_day - 1;
  let day = clock.last_settled_day + 1;
  let settled = 0;
  const settler = await accountFor(near, DEMO_ACCOUNTS[0].accountId);

  while (day <= lastFinished && settled < 6) {
    try {
      await call(settler, "settle_day", { day }, { gas: SETTLE_GAS });
      console.log(`settled day ${day}`);
    } catch (error) {
      console.error(`settle day ${day} failed:`, error.message || error);
      break;
    }
    day += 1;
    settled += 1;
  }
}

async function claimAndEnlist(near, player, clock) {
  const acct = await accountFor(near, player.accountId);
  const fromDay = Math.max(1, clock.current_day - 14);

  const claims = await view(near, "get_claims", {
    account_id: player.accountId,
    from_day: fromDay,
    to_day: clock.current_day,
  });

  for (const item of claims) {
    if (!item.settled) continue;
    if (!item.stake_claimed && item.stake_payout !== "0") {
      try {
        await call(acct, "claim_stake", { day: item.day });
        console.log(
          `${player.label}: claimed ${asWar(item.stake_payout)} WAR stake for day ${item.day}`,
        );
      } catch (error) {
        console.error(`${player.label}: claim_stake failed`, error.message || error);
      }
    }
    if (
      !item.reward_claimed &&
      !item.rewards_closed &&
      item.reward_payout !== "0"
    ) {
      try {
        await call(acct, "claim_reward", { day: item.day });
        console.log(
          `${player.label}: claimed ${asWar(item.reward_payout)} WAR reward for day ${item.day}`,
        );
      } catch (error) {
        console.error(`${player.label}: claim_reward failed`, error.message || error);
      }
    }
  }

  await sleep(800);
  const today = await view(near, "get_enlistment", {
    day: clock.current_day,
    account_id: player.accountId,
  });
  if (today) return;

  // Alternate which faction stakes the primary amount. The secondary side
  // becomes the underdog and gets the bonus, so the daily winner (and the
  // map) alternates instead of producing 100k-vs-100k ties forever.
  const primaryFaction = clock.current_day % 2 === 1 ? 0 : 1;
  const target =
    player.faction === primaryFaction ? PRIMARY_STAKE : SECONDARY_STAKE;

  const balance = BigInt(
    await view(near, "ft_balance_of", { account_id: player.accountId }),
  );
  if (balance < MIN_STAKE) {
    console.log(`${player.label}: ${asWar(balance)} WAR, below min stake`);
    return;
  }
  const stake = balance >= target ? target : balance;
  try {
    await call(acct, "enlist", { stake: stake.toString() });
    console.log(
      `${player.label}: enlisted ${asWar(stake)} WAR for day ${clock.current_day} (primary ${primaryFaction === 0 ? "DOGS" : "CATS"})`,
    );
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("already enlisted")) return;
    console.error(`${player.label}: enlist failed`, message);
  }
}

async function claimSeasons(near, player, clock) {
  const acct = await accountFor(near, player.accountId);
  for (
    let season = Math.max(1, clock.current_season - 2);
    season < clock.current_season;
    season += 1
  ) {
    try {
      const state = await view(near, "get_season_player", {
        season,
        account_id: player.accountId,
      });
      if (state?.eligible && !state.claimed) {
        await call(acct, "claim_season", { season });
        console.log(
          `${player.label}: claimed season ${season} bonus ${asWar(state.payout_preview)} WAR`,
        );
      }
    } catch (error) {
      console.error(`${player.label}: season claim failed`, error.message || error);
    }
  }
}

async function tick(near) {
  await settleOverdue(near);
  await sleep(1200);
  const clock = await view(near, "get_clock");
  for (const player of DEMO_ACCOUNTS) {
    await claimSeasons(near, player, clock);
    await claimAndEnlist(near, player, clock);
  }
}

async function main() {
  const near = await connectNear();
  console.log(`Meme Wars keeper · ${CONTRACT_ID} · every 30s`);
  await tick(near);
  setInterval(() => {
    tick(near).catch((error) => console.error("keeper tick failed:", error));
  }, 30_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
