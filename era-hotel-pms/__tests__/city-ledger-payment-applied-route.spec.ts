jest.mock("@/lib/prisma", () => {
  return {
    prisma: {
      folioPayment: {
        findFirst: jest.fn(),
      },
      folio: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    },
  };
});

jest.mock("@/lib/api-utils", () => {
  return {
    jsonOk: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      }),
    handleRouteError: (err: unknown) =>
      new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
  };
});

jest.mock("@/lib/services/folio.service", () => {
  return {
    postPayment: jest.fn(),
    folioBalance: jest.fn(),
  };
});

describe("city-ledger payment-applied (idempotency)", () => {
  const mockedPrisma = jest.requireMock("@/lib/prisma").prisma;
  const mockedFolioService = jest.requireMock("@/lib/services/folio.service");

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "test-token";
  });

  it("does not double-post when FolioPayment with registerRef exists", async () => {
    const { POST } = await import(
      "../app/api/internal/v1/city-ledger/payment-applied/route"
    );

    mockedPrisma.folioPayment.findFirst.mockResolvedValue({ id: "fp-1" });

    mockedFolioService.folioBalance.mockReturnValue(0);
    mockedPrisma.folio.findUnique
      // idempotency branch: refreshed folio with charges/payments
      .mockResolvedValueOnce({
        id: "folio-1",
        status: "TRANSFERRED_AR",
        charges: [],
        payments: [],
      });

    const req = new Request("http://localhost/api/internal/v1/city-ledger/payment-applied", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: JSON.stringify({
        folioId: "folio-1",
        invoiceId: "inv-1",
        paymentId: "pay-1",
        amount: 10,
        currency: "AZN",
        fullyPaid: true,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(mockedFolioService.postPayment).not.toHaveBeenCalled();
    expect(mockedPrisma.folio.update).toHaveBeenCalled();
    expect(body.alreadyApplied).toBe(true);
  });
});

