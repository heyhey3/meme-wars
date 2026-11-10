import { actionCreators, type Action } from "@near-wallet-selector/core";
import { GAS_100 } from "./contract";

export type NearAction = Action;

export interface ActionOptions {
  gas?: string;
  deposit?: string;
}

export function fc(
  methodName: string,
  args: Record<string, unknown> = {},
  options: ActionOptions = {},
): NearAction {
  return actionCreators.functionCall(
    methodName,
    args,
    BigInt(options.gas ?? GAS_100),
    BigInt(options.deposit ?? "0"),
  );
}
