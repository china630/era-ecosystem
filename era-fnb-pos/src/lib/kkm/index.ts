import { MockKkmDriver } from "./mock-driver";
import type { FiscalizeInput, FiscalizeResult, KkmDriver } from "./types";

const drivers: Record<string, KkmDriver> = {
  mock: new MockKkmDriver(),
};

export function resolveKkmDriver(): KkmDriver {
  const key = (process.env.KKM_DRIVER ?? "mock").trim().toLowerCase();
  return drivers[key] ?? drivers.mock;
}

export async function fiscalizeTicketPayment(
  input: FiscalizeInput,
): Promise<FiscalizeResult> {
  return resolveKkmDriver().fiscalize(input);
}

export type { FiscalizeInput, FiscalizeResult, KkmDriver };
