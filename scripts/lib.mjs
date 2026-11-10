import os from "node:os";
import path from "node:path";
import { connect, keyStores } from "near-api-js";

export const NETWORK_ID = process.env.NEAR_NETWORK || "testnet";
export const NODE_URL =
  process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com";
export const CONTRACT_ID = process.env.CONTRACT_ID || "war-demo.testnet";
export const DECIMALS = 24;
export const ONE_WAR = 10n ** BigInt(DECIMALS);
export const MIN_STAKE = 1_000n * ONE_WAR;
export const STAKE = 100_000n * ONE_WAR;

export const DEMO_ACCOUNTS = [
  { accountId: "meme-wars-dogs.testnet", faction: 0, label: "DOGS" },
  { accountId: "meme-wars-cats.testnet", faction: 1, label: "CATS" },
];

export async function connectNear() {
  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(
    path.join(os.homedir(), ".near-credentials"),
  );
  return connect({
    networkId: NETWORK_ID,
    nodeUrl: NODE_URL,
    keyStore,
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function view(near, method, args = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await near.connection.provider.query({
        request_type: "call_function",
        finality: "optimistic",
        account_id: CONTRACT_ID,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      });
      const text = Buffer.from(result.result).toString("utf8");
      return text ? JSON.parse(text) : null;
    } catch (error) {
      const message = String(error?.message || error);
      if (attempt < 2 && (message.includes("429") || message.includes("Rate limit"))) {
        await sleep(1800 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
}

export async function call(account, methodName, args = {}, options = {}) {
  return account.functionCall({
    contractId: CONTRACT_ID,
    methodName,
    args,
    gas: options.gas || "100000000000000",
    attachedDeposit: options.deposit || "0",
  });
}

export function asWar(raw) {
  return (BigInt(raw) / ONE_WAR).toLocaleString("en-US");
}
