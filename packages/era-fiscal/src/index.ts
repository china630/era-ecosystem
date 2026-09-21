import {
  fiscalize,
  listDevicesForContext,
  refundForSatellite,
  saleForSatellite,
  voidForSatellite,
} from "./facade";
import {
  listDevices,
  resolveDefaultDevices,
} from "./defaults";
import {
  createMemoryDeviceDirectory,
  getDeviceDirectory,
  resetDeviceDirectoryForTests,
  setDeviceDirectory,
  type DeviceDirectory,
} from "./device-directory";
import {
  createMemoryIdempotencyStore,
  getIdempotencyStore,
  resetIdempotencyStoreForTests,
  setIdempotencyStore,
} from "./idempotency";
import {
  resolveFiscalDriver,
  resolveFiscalDriverByProvider,
  resolveFiscalProviderName,
} from "./drivers/registry";
import { MockFiscalDriver } from "./drivers/mock";
import { NbcFiscalDriverStub } from "./drivers/nbc-stub";
import { NbcFiscalDriverHttp } from "./drivers/nbc-http";
import { CybernetFiscalDriverStub } from "./drivers/cybernet-stub";
import { CybernetFiscalDriverHttp } from "./drivers/cybernet-http";
import { OmnitechFiscalDriver } from "./drivers/omnitech";

export type {
  FiscalDeviceKind,
  FiscalDeviceStatus,
  FiscalDeviceRef,
  FiscalContext,
  SaleLine,
  Tender,
  SaleInput,
  SaleResult,
  RefundInput,
  VoidInput,
  DeviceShiftInput,
  DeviceReportResult,
  BankAuthInput,
  BankAuthResult,
  DeviceStatusResult,
  FiscalizeInput,
  FiscalizeResult,
  SaleForSatelliteOutcome,
  FiscalDriver,
} from "./types";

export { FiscalError, FISCAL_ERROR } from "./types";

export {
  fiscalize,
  saleForSatellite,
  refundForSatellite,
  voidForSatellite,
  listDevices,
  listDevicesForContext,
  resolveDefaultDevices,
  resolveFiscalDriver,
  resolveFiscalDriverByProvider,
  resolveFiscalProviderName,
  getDeviceDirectory,
  setDeviceDirectory,
  createMemoryDeviceDirectory,
  resetDeviceDirectoryForTests,
  getIdempotencyStore,
  setIdempotencyStore,
  createMemoryIdempotencyStore,
  resetIdempotencyStoreForTests,
  MockFiscalDriver,
  NbcFiscalDriverStub,
  NbcFiscalDriverHttp,
  CybernetFiscalDriverStub,
  CybernetFiscalDriverHttp,
  OmnitechFiscalDriver,
};

export type { DeviceDirectory };

export {
  FISCAL_PROVIDER_CREDENTIAL_SCHEMAS,
  credentialSchemaForProvider,
  type ProviderCredentialSchema,
} from "./credentials";
