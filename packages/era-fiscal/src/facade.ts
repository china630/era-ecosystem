import { resolveDefaultDevices, listDevices } from "./defaults";
import { getDeviceDirectory } from "./device-directory";
import { getIdempotencyStore, idempotencyKey } from "./idempotency";
import { resolveFiscalDriverByProvider } from "./drivers/registry";
import type {
  FiscalContext,
  FiscalDeviceKind,
  FiscalDeviceRef,
  FiscalizeInput,
  FiscalizeResult,
  RefundInput,
  SaleForSatelliteOutcome,
  SaleInput,
  SaleResult,
  VoidInput,
} from "./types";
import { FISCAL_ERROR, FiscalError } from "./types";

export { listDevices, resolveDefaultDevices };

function isLiveFiscal(): boolean {
  return process.env.ERA_FISCAL_LIVE === "true";
}

function emptyCatalogOutcome(organizationId: string): SaleForSatelliteOutcome {
  if (isLiveFiscal()) {
    throw new FiscalError(
      FISCAL_ERROR.LIVE_DEVICE_REQUIRED,
      `Live fiscal required: no active KKM for org ${organizationId}`,
    );
  }
  return { skipped: true, reason: "recorded_no_device" };
}

/**
 * Sale with default cascade + empty-catalog Kafe path + idempotency.
 * Does not apply parent_fiscal routing (satellite-kit does that).
 */
export async function saleForSatellite(
  input: SaleInput,
): Promise<SaleForSatelliteOutcome> {
  const directory = getDeviceDirectory();
  const kkmInOrg = directory
    .list(input.organizationId)
    .filter((d) => d.kind === "FISCAL_KKM" && d.status === "active");

  if (kkmInOrg.length === 0) {
    return emptyCatalogOutcome(input.organizationId);
  }

  const needsBank = input.tenders.some((t) =>
    /card/i.test(t.method.trim()),
  );
  const bankInOrg = directory
    .list(input.organizationId)
    .filter((d) => d.kind === "BANK_POS" && d.status === "active");
  const resolved = resolveDefaultDevices(
    {
      ...input,
      requireFiscal: true,
      requireBank: needsBank && bankInOrg.length > 0,
    },
    directory,
  );

  if (!resolved.fiscalDeviceId) {
    throw new FiscalError(
      FISCAL_ERROR.DEVICE_SELECTION_REQUIRED,
      "Fiscal device required for sale",
    );
  }

  const device = directory.get(input.organizationId, resolved.fiscalDeviceId);
  if (!device) {
    throw new FiscalError(
      FISCAL_ERROR.DEVICE_NOT_FOUND,
      `Fiscal device ${resolved.fiscalDeviceId} missing`,
    );
  }

  const key = idempotencyKey(
    input.organizationId,
    input.documentRef,
    resolved.fiscalDeviceId,
  );
  const store = getIdempotencyStore();
  const cached = store.get(key);
  if (cached) return cached;

  const driver = resolveFiscalDriverByProvider(device.providerId, device);
  let bankAuthRef: string | null = null;
  if (needsBank && resolved.bankTerminalId) {
    const bankDev = directory.get(input.organizationId, resolved.bankTerminalId);
    if (bankDev) {
      const bankDriver = resolveFiscalDriverByProvider(bankDev.providerId, bankDev);
      const cardTender = input.tenders.find((t) => /card/i.test(t.method));
      if (cardTender) {
        const auth = await bankDriver.bankAuthorize({
          ...input,
          bankTerminalId: resolved.bankTerminalId,
          amount: cardTender.amount,
          documentRef: input.documentRef,
        });
        bankAuthRef = auth.authRef;
      }
    }
  }

  const result = await driver.sale({
    ...input,
    fiscalDeviceId: resolved.fiscalDeviceId,
    bankTerminalId: resolved.bankTerminalId ?? undefined,
  });
  const withBank: SaleResult = {
    ...result,
    bankTerminalId: resolved.bankTerminalId,
    bankAuthRef,
  };
  store.set(key, withBank);
  return withBank;
}

async function runLinkedOp(
  input: (RefundInput | VoidInput) & { op: "refund" | "void" },
): Promise<SaleForSatelliteOutcome> {
  const directory = getDeviceDirectory();
  const kkmInOrg = directory
    .list(input.organizationId)
    .filter((d) => d.kind === "FISCAL_KKM" && d.status === "active");
  if (kkmInOrg.length === 0) {
    return emptyCatalogOutcome(input.organizationId);
  }
  const resolved = resolveDefaultDevices(
    {
      ...input,
      requireFiscal: true,
    },
    directory,
  );
  if (!resolved.fiscalDeviceId) {
    throw new FiscalError(
      FISCAL_ERROR.DEVICE_SELECTION_REQUIRED,
      "Fiscal device required",
    );
  }
  const device = directory.get(input.organizationId, resolved.fiscalDeviceId);
  if (!device) {
    throw new FiscalError(
      FISCAL_ERROR.DEVICE_NOT_FOUND,
      `Fiscal device ${resolved.fiscalDeviceId} missing`,
    );
  }
  const key = idempotencyKey(
    input.organizationId,
    `${input.op}:${input.documentRef}`,
    resolved.fiscalDeviceId,
  );
  const store = getIdempotencyStore();
  const cached = store.get(key);
  if (cached) return cached;
  const driver = resolveFiscalDriverByProvider(device.providerId, device);
  const result =
    input.op === "refund"
      ? await driver.refund({
          ...(input as RefundInput),
          fiscalDeviceId: resolved.fiscalDeviceId,
        })
      : await driver.voidReceipt({
          ...(input as VoidInput),
          fiscalDeviceId: resolved.fiscalDeviceId,
        });
  store.set(key, result);
  return result;
}

export async function refundForSatellite(
  input: RefundInput,
): Promise<SaleForSatelliteOutcome> {
  return runLinkedOp({ ...input, op: "refund" });
}

export async function voidForSatellite(
  input: VoidInput,
): Promise<SaleForSatelliteOutcome> {
  return runLinkedOp({ ...input, op: "void" });
}

function skippedFiscalize(reason: "recorded_no_device"): FiscalizeResult {
  return {
    receiptId: "",
    qrPayload: null,
    driver: "none",
    skipped: true,
    skipReason: reason,
  };
}

/** Legacy adapter: single synthetic line → sale (or env mock when no org id). */
export async function fiscalize(
  input: FiscalizeInput,
  env?: NodeJS.ProcessEnv,
): Promise<FiscalizeResult> {
  const orgId = input.organizationId?.trim() || "legacy";
  const directory = getDeviceDirectory();
  const hasDevices = directory
    .list(orgId)
    .some((d) => d.kind === "FISCAL_KKM" && d.status === "active");

  if (hasDevices && orgId !== "legacy") {
    const outcome = await saleForSatellite({
      organizationId: orgId,
      documentRef: input.documentRef,
      outletCode: input.outletCode,
      registerRef: input.registerRef,
      fiscalDeviceId: input.fiscalDeviceId,
      bankTerminalId: input.bankTerminalId,
      shiftFiscalDeviceId: input.shiftFiscalDeviceId,
      shiftBankTerminalId: input.shiftBankTerminalId,
      currency: input.currency,
      metadata: input.metadata,
      lines: input.lines?.length
        ? input.lines
        : [
            {
              name: "Sale",
              qty: 1,
              unitPrice: input.amount,
            },
          ],
      tenders: [{ method: input.paymentMethod, amount: input.amount }],
    });
    if ("skipped" in outcome) {
      return skippedFiscalize(outcome.reason);
    }
    return {
      receiptId: outcome.receiptId,
      qrPayload: outcome.qrPayload,
      driver: outcome.driver,
      fiscalDeviceId: outcome.fiscalDeviceId,
    };
  }

  // Real org + empty catalog: Kafe / no hardware — not env mock receipts.
  if (orgId !== "legacy") {
    if (isLiveFiscal()) {
      throw new FiscalError(
        FISCAL_ERROR.LIVE_DEVICE_REQUIRED,
        `Live fiscal required: no active KKM for org ${orgId}`,
      );
    }
    return skippedFiscalize("recorded_no_device");
  }

  // Env fallback only when organizationId is omitted (local unit tests / pre-F2).
  const { resolveFiscalDriver } = await import("./drivers/registry");
  const driver = resolveFiscalDriver(env);
  if (driver.fiscalize) {
    return driver.fiscalize(input);
  }
  const sale = await driver.sale({
    organizationId: orgId,
    documentRef: input.documentRef,
    outletCode: input.outletCode,
    registerRef: input.registerRef,
    fiscalDeviceId: "env-fallback",
    currency: input.currency,
    metadata: input.metadata,
    lines: [
      {
        name: "Sale",
        qty: 1,
        unitPrice: input.amount,
      },
    ],
    tenders: [{ method: input.paymentMethod, amount: input.amount }],
  });
  return {
    receiptId: sale.receiptId,
    qrPayload: sale.qrPayload,
    driver: sale.driver,
  };
}

export function listDevicesForContext(
  ctx: FiscalContext & { kind?: FiscalDeviceKind },
): FiscalDeviceRef[] {
  return listDevices(ctx);
}
