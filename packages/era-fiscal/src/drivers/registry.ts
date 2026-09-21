import { FISCAL_ERROR, FiscalError, type FiscalDriver } from "../types";
import type { FiscalDeviceRef } from "../types";
import { CybernetFiscalDriverStub } from "./cybernet-stub";
import { CybernetFiscalDriverHttp } from "./cybernet-http";
import { MockFiscalDriver } from "./mock";
import { NbcFiscalDriverHttp } from "./nbc-http";
import { NbcFiscalDriverStub } from "./nbc-stub";
import { OmnitechFiscalDriver } from "./omnitech";

function applyDeviceTransport(
  driver: { setEndpoint?(url: string): void; setAuthToken?(token: string): void },
  device?: FiscalDeviceRef,
): void {
  const endpoint = device?.endpoint?.trim();
  if (endpoint) driver.setEndpoint?.(endpoint);
  const token = device?.secrets?.apiToken?.trim();
  if (token) driver.setAuthToken?.(token);
}

/** Resolve by device.providerId (preferred). Uses device.endpoint + hydrated secrets. */
export function resolveFiscalDriverByProvider(
  providerId: string,
  device?: FiscalDeviceRef,
): FiscalDriver {
  const key = providerId.trim().toLowerCase();
  const endpoint = device?.endpoint?.trim();

  if (key === "mock") return new MockFiscalDriver();
  if (key === "omnitech") {
    const d = new OmnitechFiscalDriver();
    applyDeviceTransport(d, device);
    return d;
  }
  if (key === "nbc") {
    if (endpoint || process.env.ERA_FISCAL_NBC_URL?.trim()) {
      const d = new NbcFiscalDriverHttp();
      applyDeviceTransport(d, device);
      return d;
    }
    return new NbcFiscalDriverStub();
  }
  if (key === "cybernet") {
    if (endpoint || process.env.ERA_FISCAL_CYBERNET_URL?.trim()) {
      const d = new CybernetFiscalDriverHttp();
      applyDeviceTransport(d, device);
      return d;
    }
    return new CybernetFiscalDriverStub();
  }
  throw new FiscalError(
    FISCAL_ERROR.NOT_IMPLEMENTED,
    `Unknown fiscal provider: ${providerId}`,
  );
}

/** @deprecated Env-based resolve when device directory is empty. */
export function resolveFiscalProviderName(env?: NodeJS.ProcessEnv): string {
  const e = env ?? process.env;
  return (e.ERA_FISCAL_PROVIDER ?? e.KKM_DRIVER ?? "mock").trim().toLowerCase();
}

export function resolveFiscalDriver(env?: NodeJS.ProcessEnv): FiscalDriver {
  const key = resolveFiscalProviderName(env);
  return resolveFiscalDriverByProvider(key);
}
