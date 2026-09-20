import { randomUUID } from "crypto";
import {
  FISCAL_ERROR,
  FiscalError,
  type BankAuthInput,
  type BankAuthResult,
  type DeviceReportResult,
  type DeviceShiftInput,
  type DeviceStatusResult,
  type FiscalDriver,
  type FiscalizeInput,
  type FiscalizeResult,
  type RefundInput,
  type SaleInput,
  type SaleResult,
  type VoidInput,
} from "../types";

/** Shared stubs for drivers that only implement sale/fiscalize until F5. */
export abstract class PartialFiscalDriver implements FiscalDriver {
  abstract readonly name: string;
  abstract fiscalize(input: FiscalizeInput): Promise<FiscalizeResult>;

  async sale(input: SaleInput & { fiscalDeviceId: string }): Promise<SaleResult> {
    const total = input.tenders.reduce((s, t) => s + t.amount, 0);
    const method = input.tenders[0]?.method ?? "CASH";
    const r = await this.fiscalize({
      documentRef: input.documentRef,
      amount: total,
      currency: input.currency,
      paymentMethod: method,
      registerRef: input.registerRef,
      outletCode: input.outletCode,
      organizationId: input.organizationId,
      fiscalDeviceId: input.fiscalDeviceId,
      bankTerminalId: input.bankTerminalId,
      lines: input.lines,
      metadata: input.metadata,
    });
    return {
      receiptId: r.receiptId,
      qrPayload: r.qrPayload,
      driver: r.driver,
      fiscalDeviceId: input.fiscalDeviceId,
      bankTerminalId: input.bankTerminalId ?? null,
    };
  }

  async refund(
    input: RefundInput & { fiscalDeviceId: string },
  ): Promise<SaleResult> {
    throw new FiscalError(
      FISCAL_ERROR.NOT_IMPLEMENTED,
      `${this.name}: refund not implemented yet`,
    );
  }

  async voidReceipt(
    _input: VoidInput & { fiscalDeviceId: string },
  ): Promise<SaleResult> {
    throw new FiscalError(
      FISCAL_ERROR.NOT_IMPLEMENTED,
      `${this.name}: void not implemented yet`,
    );
  }

  async openShift(_input: DeviceShiftInput): Promise<DeviceReportResult> {
    throw new FiscalError(
      FISCAL_ERROR.NOT_IMPLEMENTED,
      `${this.name}: openShift not implemented yet`,
    );
  }

  async xReport(_input: DeviceShiftInput): Promise<DeviceReportResult> {
    throw new FiscalError(
      FISCAL_ERROR.NOT_IMPLEMENTED,
      `${this.name}: xReport not implemented yet`,
    );
  }

  async zReport(_input: DeviceShiftInput): Promise<DeviceReportResult> {
    throw new FiscalError(
      FISCAL_ERROR.NOT_IMPLEMENTED,
      `${this.name}: zReport not implemented yet`,
    );
  }

  async bankAuthorize(input: BankAuthInput): Promise<BankAuthResult> {
    return {
      authRef: `${this.name.toUpperCase()}-AUTH-${randomUUID().slice(0, 8)}`,
      driver: this.name,
      amount: input.amount,
    };
  }

  async bankCapture(
    input: BankAuthInput & { authRef: string },
  ): Promise<BankAuthResult> {
    return { authRef: input.authRef, driver: this.name, amount: input.amount };
  }

  async bankReverse(
    input: BankAuthInput & { authRef: string },
  ): Promise<BankAuthResult> {
    return {
      authRef: `REV-${input.authRef}`,
      driver: this.name,
      amount: input.amount,
    };
  }

  async status(input: DeviceShiftInput): Promise<DeviceStatusResult> {
    return {
      online: false,
      driver: this.name,
      detail: `stub:${input.fiscalDeviceId}`,
    };
  }

  async lastReceipt(_input: DeviceShiftInput): Promise<SaleResult | null> {
    return null;
  }
}
