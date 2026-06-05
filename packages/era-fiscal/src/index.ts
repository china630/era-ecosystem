import { CybernetFiscalDriverStub } from "./drivers/cybernet-stub";
import { MockFiscalDriver } from "./drivers/mock";
import { NbcFiscalDriverStub } from "./drivers/nbc-stub";
import type { FiscalDriver, FiscalizeInput, FiscalizeResult } from "./types";

export type { FiscalDriver, FiscalizeInput, FiscalizeResult };

const drivers: Record<string, FiscalDriver> = {
  mock: new MockFiscalDriver(),
  nbc: new NbcFiscalDriverStub(),
  cybernet: new CybernetFiscalDriverStub(),
};

export function resolveFiscalProviderName(env?: NodeJS.ProcessEnv): string {
  const e = env ?? process.env;
  return (
    e.ERA_FISCAL_PROVIDER ??
    e.KKM_DRIVER ??
    "mock"
  )
    .trim()
    .toLowerCase();
}

export function resolveFiscalDriver(env?: NodeJS.ProcessEnv): FiscalDriver {
  const key = resolveFiscalProviderName(env);
  return drivers[key] ?? drivers.mock;
}

export async function fiscalize(
  input: FiscalizeInput,
  env?: NodeJS.ProcessEnv,
): Promise<FiscalizeResult> {
  return resolveFiscalDriver(env).fiscalize(input);
}

export { MockFiscalDriver, NbcFiscalDriverStub, CybernetFiscalDriverStub };
