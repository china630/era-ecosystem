import { randomUUID } from "crypto";
import type {
  BankAuthInput,
  BankAuthResult,
  DeviceReportResult,
  DeviceShiftInput,
  DeviceStatusResult,
  FiscalDriver,
  FiscalizeInput,
  FiscalizeResult,
  RefundInput,
  SaleInput,
  SaleResult,
  VoidInput,
} from "../types";

export class MockFiscalDriver implements FiscalDriver {
  readonly name = "mock";

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const id = `KKM-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `https://example.az/receipt/${id}?amount=${input.amount}&ref=${input.documentRef}`,
      driver: this.name,
    };
  }

  async sale(input: SaleInput & { fiscalDeviceId: string }): Promise<SaleResult> {
    const total = input.tenders.reduce((s, t) => s + t.amount, 0);
    const id = `KKM-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `https://example.az/receipt/${id}?amount=${total}&ref=${input.documentRef}`,
      driver: this.name,
      fiscalDeviceId: input.fiscalDeviceId,
      bankTerminalId: input.bankTerminalId ?? null,
    };
  }

  async refund(
    input: RefundInput & { fiscalDeviceId: string },
  ): Promise<SaleResult> {
    const id = `KKM-R-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `https://example.az/refund/${id}?orig=${input.originalReceiptId}`,
      driver: this.name,
      fiscalDeviceId: input.fiscalDeviceId,
    };
  }

  async voidReceipt(
    input: VoidInput & { fiscalDeviceId: string },
  ): Promise<SaleResult> {
    const id = `KKM-V-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: null,
      driver: this.name,
      fiscalDeviceId: input.fiscalDeviceId,
    };
  }

  async openShift(input: DeviceShiftInput): Promise<DeviceReportResult> {
    return { reportId: `OPEN-${input.fiscalDeviceId}`, driver: this.name };
  }

  async xReport(input: DeviceShiftInput): Promise<DeviceReportResult> {
    return { reportId: `X-${input.fiscalDeviceId}`, driver: this.name };
  }

  async zReport(input: DeviceShiftInput): Promise<DeviceReportResult> {
    return { reportId: `Z-${input.fiscalDeviceId}`, driver: this.name };
  }

  async bankAuthorize(input: BankAuthInput): Promise<BankAuthResult> {
    return {
      authRef: `AUTH-${randomUUID().slice(0, 8)}`,
      driver: this.name,
      amount: input.amount,
    };
  }

  async bankCapture(
    input: BankAuthInput & { authRef: string },
  ): Promise<BankAuthResult> {
    return {
      authRef: input.authRef,
      driver: this.name,
      amount: input.amount,
    };
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
      online: true,
      driver: this.name,
      lastReceiptId: null,
      detail: `mock:${input.fiscalDeviceId}`,
    };
  }

  async lastReceipt(_input: DeviceShiftInput): Promise<SaleResult | null> {
    return null;
  }
}
