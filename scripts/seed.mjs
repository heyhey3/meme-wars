/**
 * One-time demo seeding.
 *
 * Creates a real two-sided battle on the testnet demo:
 *   - registers each demo account for NEP-141 storage
 *   - claims the demo faucet (100,000 WAR)
 *   - joins DOGS / CATS
 *   - enlists the maximum it can
 *
 * Keys are read from ~/.near-credentials/testnet/<account>.json. They are
 * created by `near account create-account ... save-to-legacy-keychain` and
 * never committed. The script is idempotent.
 */
import {
  CONTRACT_ID,
  DEMO_ACCOUNTS,
  MIN_STAKE,
  STAKE,
  asWar,
  call,
  connectNear,
  view,
} from "./lib.mjs";

const STORAGE_DEPOSIT = "10000000000000000000000"; // 0.01 NEAR

async function ensureAccount(near, player) {
  const acct = await near.account(player.accountId);
  const faucet = await view(near, "get_faucet_state", {
    account_id: player.accountId,
  });

  if (!faucet.registered) {
    console.log(`${player.label}: storage_deposit`);
    await call(
      acct,
      "storage_deposit",
      { account_id: player.accountId, registration_only: true },
      { gas: "60000000000000", deposit: STORAGE_DEPOSIT },
    );
  }

  if (!faucet.claimed) {
    console.log(`${player.label}: claim_faucet`);
    await call(acct, "claim_faucet", {}, { gas: "60000000000000" });
  }

  const member = await view(near, "get_member", {
    account_id: player.accountId,
  });
  if (!member) {
    console.log(`${player.label}: join_faction ${player.faction}`);
    await call(acct, "join_faction", { faction: player.faction });
  }

  const clock = await view(near, "get_clock");
  const enlisted = await view(near, "get_enlistment", {
    day: clock.current_day,
    account_id: player.accountId,
  });
  if (!enlisted) {
    const balance = BigInt(
      await view(near, "ft_balance_of", { account_id: player.accountId }),
    );
    if (balance < MIN_STAKE) {
      console.log(
        `${player.label}: balance ${asWar(balance)} WAR is below min stake`,
      );
      return;
    }
    const stake = balance >= STAKE ? STAKE : balance;
    console.log(
      `${player.label}: enlist ${asWar(stake)} WAR for day ${clock.current_day}`,
    );
    await call(acct, "enlist", { stake: stake.toString() });
  }

  const balance = await view(near, "ft_balance_of", {
    account_id: player.accountId,
  });
  console.log(`${player.label}: ready, available ${asWar(balance)} WAR`);
}

async function main() {
  const near = await connectNear();
  const clock = await view(near, "get_clock");
  console.log(
    `Seeding ${CONTRACT_ID} · day ${clock.current_day} · demo=${clock.day_length_ns / 1e9}s`,
  );
  for (const player of DEMO_ACCOUNTS) {
    await ensureAccount(near, player);
  }
  const day = await view(near, "get_day", { day: clock.current_day });
  console.log(
    `Today: DOGS ${asWar(day?.total_power?.[0] ?? "0")} power vs CATS ${asWar(
      day?.total_power?.[1] ?? "0",
    )} power`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
