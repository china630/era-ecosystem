import {
  buildInvoicePrintSnapshot,
  renderFinanceInvoiceCommercialHtml,
  safePrintLogoSrc,
} from "../../src/invoices/invoice-print-snapshot.build";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { Prisma } from "@erafinance/database";

const Decimal = Prisma.Decimal;
const orgId = "00000000-0000-0000-0000-000000000001";
const otherOrg = "00000000-0000-0000-0000-000000000099";
const invoiceId = "inv-1";

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: invoiceId,
    organizationId: orgId,
    number: "INV-100",
    status: "CANCELLED",
    dueDate: new Date("2026-09-20T12:00:00.000Z"),
    currency: "AZN",
    totalAmount: new Decimal("118.0000"),
    paidAmount: new Decimal("0"),
    tradeContext: null,
    extraAttributes: { vehicle_plate: "10-AA-100", ghost: "no" },
    counterparty: {
      nameCipher: null,
      taxIdCipher: null,
    },
    items: [
      {
        description: "Widget",
        quantity: new Decimal("1"),
        unitPrice: new Decimal("100"),
        vatRate: new Decimal("18"),
        lineTotal: new Decimal("118"),
        product: { name: "Widget", sku: "W1" },
      },
    ],
    organization: {
      name: "Acme LLC",
      taxIdCipher: null,
      legalAddress: "Baku",
      logoUrl: null,
      bankAccountsOrg: [
        {
          bankName: "Bank",
          accountNumber: "123",
          currency: "AZN",
          iban: null,
          swift: null,
        },
      ],
    },
    ...overrides,
  };
}

describe("buildInvoicePrintSnapshot (AC-FIN-PRINT)", () => {
  it("returns null for other org / missing invoice", async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      extraFieldDefinition: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const snap = await buildInvoicePrintSnapshot(
      prisma,
      otherOrg,
      invoiceId,
      "az",
    );
    expect(snap).toBeNull();
  });

  it("includes extras only for active definitions; cancelled still printable", async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(baseInvoice()),
      },
      extraFieldDefinition: {
        findMany: jest.fn().mockResolvedValue([{ key: "vehicle_plate" }]),
      },
    } as unknown as PrismaService;
    const snap = await buildInvoicePrintSnapshot(prisma, orgId, invoiceId, "en");
    expect(snap).not.toBeNull();
    expect(snap!.values["invoice.status"]).toBe("CANCELLED");
    expect(snap!.values["extra.vehicle_plate"]).toBe("10-AA-100");
    expect(snap!.values["extra.ghost"]).toBeUndefined();
    expect(snap!.whitelist).toContain("extra.vehicle_plate");
    expect(snap!.whitelist).not.toContain("extra.ghost");
    expect(snap!.lang).toBe("en");
    expect(snap!.lines?.[0]["line.sku"]).toBe("W1");
  });

  it("renders vendor HTML with lines and extras", async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(baseInvoice()),
      },
      extraFieldDefinition: {
        findMany: jest.fn().mockResolvedValue([{ key: "vehicle_plate" }]),
      },
    } as unknown as PrismaService;
    const snap = await buildInvoicePrintSnapshot(prisma, orgId, invoiceId, "az");
    const html = renderFinanceInvoiceCommercialHtml(snap!);
    expect(html.ok).toBe(true);
    if (html.ok) {
      expect(html.html).toContain("INV-100");
      expect(html.html).toContain("Widget");
      expect(html.html).toContain("10-AA-100");
      expect(html.html).not.toContain("ghost");
    }
  });

  it("renders same-origin logo paths and rejects javascript URLs", async () => {
    expect(safePrintLogoSrc("/files/org-logos/x.png")).toBe("/files/org-logos/x.png");
    expect(safePrintLogoSrc("javascript:alert(1)")).toBeNull();
    expect(safePrintLogoSrc("//evil.example/x.png")).toBeNull();
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(
          baseInvoice({
            organization: {
              name: "Acme LLC",
              taxIdCipher: null,
              legalAddress: "Baku",
              logoUrl: "/files/org-logos/x.png",
              bankAccountsOrg: [],
            },
          }),
        ),
      },
      extraFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const snap = await buildInvoicePrintSnapshot(prisma, orgId, invoiceId, "az");
    const html = renderFinanceInvoiceCommercialHtml(snap!);
    expect(html.ok).toBe(true);
    if (html.ok) {
      expect(html.html).toContain('src="/files/org-logos/x.png"');
    }
  });
});
