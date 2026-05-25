import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { readCreditFromFinance, readCreditLimitStub } from "@/lib/credit-limit";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const counterpartyId = url.searchParams.get("counterpartyId");
    if (!counterpartyId) {
      return jsonError("counterpartyId query param is required", 400);
    }

    const authHeader =
      req.headers.get("authorization") ??
      (process.env.FINANCE_API_TOKEN
        ? `Bearer ${process.env.FINANCE_API_TOKEN}`
        : null);
    const finance = await readCreditFromFinance(counterpartyId, authHeader);
    if (finance) {
      return jsonOk({
        counterpartyId,
        creditLimit: finance.creditLimit,
        currency: "AZN",
        source: finance.source,
      });
    }

    const creditLimit = readCreditLimitStub(counterpartyId);
    return jsonOk({
      counterpartyId,
      creditLimit,
      currency: "AZN",
      source: process.env.FINANCE_API_URL ? "env_stub_fallback" : "env_stub",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
