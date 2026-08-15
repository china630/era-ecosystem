import type { PaymentOrder, PaymentRail } from "@era/bank-core-database";
import { railMode, type AdapterMode } from "../../integration/live-mode";

export type RailMode = AdapterMode;

export function resolveRailMode(
  env: NodeJS.ProcessEnv = process.env,
): RailMode {
  return railMode(env);
}

export type RailSubmitResult = {
  accepted: boolean;
  processorRef: string;
  payload: Record<string, unknown>;
};

export interface PaymentRailAdapter {
  readonly rail: PaymentRail;
  submit(order: PaymentOrder): Promise<RailSubmitResult>;
}
