import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  getSatelliteTenantContext,
  resolveSatelliteOrganizationId,
  clearProcessOrganizationBind,
  satelliteRuntimeConfig,
  setRuntimeOrganizationId,
} from "@era/satellite-kit";

/** SHARED pool must not keep one bank on the process. Dedicated / on-prem still do. */
export function isSharedBankProcess(): boolean {
  return satelliteRuntimeConfig().deploymentTopology === "SHARED";
}

/**
 * Drop the process-wide bank id. The kit still reads `ERA_SATELLITE_ORGANIZATION_ID`
 * when no request tenant is entered, so those env vars are removed too.
 */
export function releaseSharedBankProcessBind(): void {
  clearProcessOrganizationBind();
}

/** Copy env into the process bind only on a one-bank machine. */
export function bindDedicatedBankOrganizationFromEnv(): void {
  if (isSharedBankProcess()) {
    releaseSharedBankProcessBind();
    return;
  }
  const fromEnv =
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
  if (fromEnv) setRuntimeOrganizationId(fromEnv);
}

/**
 * Bank organization id.
 * SHARED: the request tenant only (`X-Organization-Id`). Process env is not a bank.
 * DEDICATED / ONPREM: request tenant, else the one process bind.
 */
@Injectable()
export class BankOrgConfig {
  constructor(_config: ConfigService) {
    bindDedicatedBankOrganizationFromEnv();
  }

  get bankOrgId(): string {
    const fromAls = getSatelliteTenantContext()?.organizationId?.trim();
    if (fromAls) return fromAls;
    if (isSharedBankProcess()) {
      throw new Error(
        "Bank organizationId is required on the request (X-Organization-Id)",
      );
    }
    const { organizationId, source } = resolveSatelliteOrganizationId({
      allowFallback: true,
    });
    if (source === "fallback") {
      throw new Error(
        "Bank organizationId is required (request header, Sync bind, or ERA_BANK_ORGANIZATION_ID)",
      );
    }
    return organizationId;
  }
}
