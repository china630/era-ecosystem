import { filterDevices, getDeviceDirectory } from "./device-directory";
import {
  FISCAL_ERROR,
  FiscalError,
  type FiscalContext,
  type FiscalDeviceKind,
  type FiscalDeviceRef,
} from "./types";

export type ResolvedDevices = {
  fiscalDeviceId: string | null;
  bankTerminalId: string | null;
};

/**
 * Default cascade (first non-empty wins per kind):
 * 1. Explicit ids on the call
 * 2. Open shift binding
 * 3. Register default
 * 4. Outlet default
 * 5. Org default
 * 6. Single active device in scope
 *
 * Several without a default → DEVICE_SELECTION_REQUIRED (never silent list[0]).
 */
export function resolveDefaultDevices(
  ctx: FiscalContext & {
    fiscalDeviceId?: string;
    bankTerminalId?: string;
    requireFiscal?: boolean;
    requireBank?: boolean;
  },
  directory = getDeviceDirectory(),
): ResolvedDevices {
  const all = directory.list(ctx.organizationId);
  const fiscalId = resolveOneKind(all, ctx, "FISCAL_KKM", {
    explicit: ctx.fiscalDeviceId,
    shiftBind: ctx.shiftFiscalDeviceId,
    require: ctx.requireFiscal === true,
  });
  const bankId = resolveOneKind(all, ctx, "BANK_POS", {
    explicit: ctx.bankTerminalId,
    shiftBind: ctx.shiftBankTerminalId,
    require: ctx.requireBank === true,
  });
  return { fiscalDeviceId: fiscalId, bankTerminalId: bankId };
}

function resolveOneKind(
  all: FiscalDeviceRef[],
  ctx: FiscalContext,
  kind: FiscalDeviceKind,
  opts: {
    explicit?: string;
    shiftBind?: string;
    require: boolean;
  },
): string | null {
  if (opts.explicit?.trim()) {
    assertKnown(all, opts.explicit.trim(), kind);
    return opts.explicit.trim();
  }
  if (opts.shiftBind?.trim()) {
    assertKnown(all, opts.shiftBind.trim(), kind);
    return opts.shiftBind.trim();
  }

  const scoped = filterDevices(all, {
    kind,
    outletCode: ctx.outletCode,
    registerRef: ctx.registerRef,
  });

  if (scoped.length === 0) {
    if (opts.require) {
      throw new FiscalError(
        FISCAL_ERROR.DEVICE_NOT_FOUND,
        `No active ${kind} device in scope`,
      );
    }
    return null;
  }

  if (ctx.registerRef) {
    const regDef = scoped.find(
      (d) => d.isRegisterDefault && d.registerCode === ctx.registerRef,
    );
    if (regDef) return regDef.id;
  }

  if (ctx.outletCode) {
    const outDef = scoped.find(
      (d) => d.isOutletDefault && (!d.outletCode || d.outletCode === ctx.outletCode),
    );
    if (outDef) return outDef.id;
  }

  const orgDef = scoped.find((d) => d.isOrgDefault);
  if (orgDef) return orgDef.id;

  if (scoped.length === 1) return scoped[0]!.id;

  if (opts.require) {
    throw new FiscalError(
      FISCAL_ERROR.DEVICE_SELECTION_REQUIRED,
      `Multiple ${kind} devices; set a default or pass an explicit id`,
    );
  }
  return null;
}

function assertKnown(
  all: FiscalDeviceRef[],
  id: string,
  kind: FiscalDeviceKind,
): void {
  const d = all.find((x) => x.id === id);
  if (!d || d.status !== "active" || d.kind !== kind) {
    throw new FiscalError(
      FISCAL_ERROR.DEVICE_NOT_FOUND,
      `Device ${id} not found or not an active ${kind}`,
    );
  }
}

export function listDevices(
  ctx: FiscalContext & { kind?: FiscalDeviceKind },
  directory = getDeviceDirectory(),
): FiscalDeviceRef[] {
  return filterDevices(directory.list(ctx.organizationId), {
    kind: ctx.kind,
    outletCode: ctx.outletCode,
    registerRef: ctx.registerRef,
  });
}
