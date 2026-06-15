import type { PaymentOrder, PaymentRail } from "@era/bank-core-database";

export type RailSubmitResult = {
  accepted: boolean;
  processorRef: string;
  payload: Record<string, unknown>;
};

export interface PaymentRailAdapter {
  readonly rail: PaymentRail;
  submit(order: PaymentOrder): Promise<RailSubmitResult>;
}
