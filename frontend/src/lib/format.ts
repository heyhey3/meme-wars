export function formatUnits(
  raw: string | bigint,
  decimals: number,
  maxFraction = 2,
): string {
  let value: bigint;
  try {
    value = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  } catch {
    value = 0n;
  }
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  let fractionString = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFraction)
    .replace(/0+$/, "");
  if (fractionString.length > 0) fractionString = `.${fractionString}`;
  return `${whole.toLocaleString("en-US")}${fractionString}`;
}

export function formatWar(
  raw: string | bigint,
  decimals = 24,
  maxFraction = 2,
): string {
  return `${formatUnits(raw, decimals, maxFraction)} WAR`;
}

export function compactUnits(
  raw: string | bigint,
  decimals: number,
): string {
  let value: bigint;
  try {
    value = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  } catch {
    return "0";
  }
  const whole = value / 10n ** BigInt(decimals);
  const abs = whole < 0n ? -whole : whole;
  const sign = whole < 0n ? "-" : "";
  if (abs >= 1_000_000_000n) {
    return `${sign}${(Number(abs / 100_000_000n) / 10).toFixed(1)}B`;
  }
  if (abs >= 1_000_000n) {
    return `${sign}${(Number(abs / 100_000n) / 10).toFixed(1)}M`;
  }
  if (abs >= 1_000n) {
    return `${sign}${(Number(abs / 100n) / 10).toFixed(1)}K`;
  }
  return `${sign}${abs.toString()}`;
}

export function parseUnits(input: string, decimals: number): bigint {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === "" || cleaned === ".") {
    throw new Error("Enter a valid amount");
  }
  const [wholePart, fractionPart = ""] = cleaned.split(".");
  if (fractionPart.length > decimals) {
    throw new Error(`Too many decimals (max ${decimals})`);
  }
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt(
    `${fractionPart}${"0".repeat(decimals - fractionPart.length)}` || "0",
  );
  return whole * 10n ** BigInt(decimals) + fraction;
}

export function percent(part: bigint, total: bigint): number {
  if (total <= 0n) return 50;
  return Number((part * 10_000n) / total) / 100;
}

export function shortAccount(accountId?: string | null): string {
  if (!accountId) return "";
  const base = accountId.replace(/\.(testnet|mainnet|near)$/i, "");
  if (base.length <= 20) return base;
  return `${base.slice(0, 12)}…${base.slice(-4)}`;
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
