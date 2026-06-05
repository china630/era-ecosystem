import { NetworkDocumentStatus, Prisma } from "@erafinance/database";
import { NetworkDocumentService } from "../../src/network/network-document.service";
import { NetworkTenantMatchService } from "../../src/network/network-tenant-match.service";
import { NetworkDocumentPostingService } from "../../src/network/network-document-posting.service";
import { InProcessNetworkDocumentTransport } from "../../src/network/transport/in-process-network-document-transport";
import { createMockPostingResolver } from "../helpers/mock-posting-resolver";

const Decimal = Prisma.Decimal;

describe("NetworkDocumentService (intercompany)", () => {
  const issuerOrgId = "00000000-0000-0000-0000-0000000000a1";
  const recipientOrgId = "00000000-0000-0000-0000-0000000000b2";
  const counterpartyId = "00000000-0000-0000-0000-0000000000c1";
  const invoiceId = "00000000-0000-0000-0000-0000000000d1";
  const blind = "blind-voen-shared";

  function build() {
    const journalCalls: unknown[] = [];
    const accounting = {
      postJournalInTransaction: jest.fn(async (_tx: unknown, params: unknown) => {
        journalCalls.push(params);
        return { transactionId: "txn-netdoc-1" };
      }),
      validateBalance: jest.fn(),
    };

    const prisma: {
      counterparty: { findFirst: jest.Mock };
      organization: { findFirst: jest.Mock };
      invoice: { findFirst: jest.Mock };
      networkDocument: {
        upsert: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
        findMany: jest.Mock;
      };
      auditLog: { create: jest.Mock };
      $transaction: jest.Mock;
    } = {
      counterparty: {
        findFirst: jest.fn(async (args: { where: { organizationId: string } }) => {
          if (args.where.organizationId === issuerOrgId) {
            return { taxIdBlindIndex: blind };
          }
          if (args.where.organizationId === recipientOrgId) {
            return { id: "cp-mirror-b" };
          }
          return null;
        }),
      },
      organization: {
        findFirst: jest.fn(async (args: { where: { id?: string; taxIdBlindIndex?: string } }) => {
          if (args.where.id === issuerOrgId) {
            return { taxIdBlindIndex: blind };
          }
          if (args.where.taxIdBlindIndex === blind) {
            return {
              id: recipientOrgId,
              settings: { networkDocuments: { acceptInbound: true } },
            };
          }
          if (args.where.id === recipientOrgId) {
            return { settings: { networkDocuments: { acceptInbound: true } } };
          }
          return null;
        }),
      },
      invoice: {
        findFirst: jest.fn(async () => ({
          id: invoiceId,
          counterpartyId,
          number: "INV-2026-0001",
          currency: "AZN",
          totalAmount: new Decimal(118),
          revenueRecognized: true,
          items: [
            {
              description: "Service",
              quantity: new Decimal(1),
              unitPrice: new Decimal(100),
              vatRate: new Decimal(18),
              lineTotal: new Decimal(118),
              productId: null,
            },
          ],
        })),
      },
      networkDocument: {
        upsert: jest.fn(async () => ({ id: "nd-1" })),
        findFirst: jest.fn(async () => ({
          id: "nd-1",
          correlationId: invoiceId,
          recipientOrganizationId: recipientOrgId,
          issuerOrganizationId: issuerOrgId,
          status: NetworkDocumentStatus.PENDING_REVIEW,
          totalNet: new Decimal(100),
          vatAmount: new Decimal(18),
          totalGross: new Decimal(118),
          issuerTaxIdBlindIndex: blind,
          issuerInvoiceNumber: "INV-2026-0001",
          sourceInvoiceId: invoiceId,
        })),
        update: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    );

    const postingResolver = createMockPostingResolver();
    (postingResolver.resolveMany as jest.Mock).mockImplementation(
      async (_org: string, roles: string[]) => {
        const out: Record<string, string> = {};
        for (const r of roles) {
          out[r] = r === "VAT_INPUT" ? "241" : r === "SUPPLIER_PAYABLE" ? "531" : "731";
        }
        return out;
      },
    );

    const match = new NetworkTenantMatchService(prisma as never);
    const inProcess = new InProcessNetworkDocumentTransport(prisma as never);
    const posting = new NetworkDocumentPostingService(
      prisma as never,
      accounting as never,
      postingResolver,
    );
    const orchestratorTransport = { deliver: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const eqaimePrefill = { buildForDocument: jest.fn().mockResolvedValue(null) };
    const documents = new NetworkDocumentService(
      prisma as never,
      match,
      posting,
      inProcess,
      orchestratorTransport as never,
      config as never,
      eqaimePrefill as never,
    );

    return { documents, posting, prisma, journalCalls, accounting, match };
  }

  it("match: same VÖEN creates document when opt-in", async () => {
    const { documents, prisma } = build();
    await documents.emitFromInvoice(issuerOrgId, invoiceId);
    expect(prisma.networkDocument.upsert).toHaveBeenCalledTimes(1);
  });

  it("no match when acceptInbound is false", async () => {
    const { documents, prisma, match } = build();
    jest.spyOn(match, "findRecipientOrgForCounterparty").mockResolvedValue(null);
    await documents.emitFromInvoice(issuerOrgId, invoiceId);
    expect(prisma.networkDocument.upsert).not.toHaveBeenCalled();
  });

  it("accept posts balanced journal and POSTED status", async () => {
    const { posting, prisma, journalCalls } = build();
    const out = await posting.acceptAndPost(recipientOrgId, "nd-1", {
      debitRole: "MISC_OPERATING_EXPENSE",
      claimsVat: true,
      postingDate: "2026-06-05",
    });
    expect(out.transactionId).toBe("txn-netdoc-1");
    expect(journalCalls.length).toBe(1);
    expect(prisma.networkDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NetworkDocumentStatus.POSTED }),
      }),
    );
  });

  it("reject does not post journal", async () => {
    const { posting, accounting } = build();
    await posting.reject(recipientOrgId, "nd-1", "Not our purchase");
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("idempotent emit uses upsert once per call", async () => {
    const { documents, prisma } = build();
    await documents.emitFromInvoice(issuerOrgId, invoiceId);
    await documents.emitFromInvoice(issuerOrgId, invoiceId);
    expect(prisma.networkDocument.upsert).toHaveBeenCalledTimes(2);
  });

  it("markSuperseded updates pending docs", async () => {
    const { documents, prisma } = build();
    const n = await documents.markSuperseded(invoiceId);
    expect(n).toBe(1);
    expect(prisma.networkDocument.updateMany).toHaveBeenCalled();
  });
});
