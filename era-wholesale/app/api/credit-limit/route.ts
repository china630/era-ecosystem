import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  createTradeCreditRequestCache,
  probeTradeCreditSku,
  readCreditFromFinance,
  readCreditLimitStub,
} from "@/lib/credit-limit";

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

    let organizationId: string | null = null;
    try {
      organizationId = requestOrganizationId();
    } catch {
      organizationId = null;
    }

    const cache = createTradeCreditRequestCache();
    const probe = await probeTradeCreditSku(
      counterpartyId,
      authHeader,
      cache,
      organizationId,
    );
    if (probe.skuEnabled && probe.facility) {
      return jsonOk({
        counterpartyId,
        creditLimit: probe.facility.creditLimit,
        available: probe.facility.available,
        stopList: probe.facility.stopList,
        currency: "AZN",
        source: probe.facility.source,
      });
    }

    const finance = await readCreditFromFinance(counterpartyId, authHeader);
    if (finance) {
      return jsonOk({
        counterpartyId,
        creditLimit: finance.creditLimit,
        available: finance.creditLimit,
        stopList: false,
        currency: "AZN",
        source: finance.source,
      });
    }

    const creditLimit = readCreditLimitStub(counterpartyId);
    return jsonOk({
      counterpartyId,
      creditLimit,
      available: creditLimit,
      stopList: false,
      currency: "AZN",
      source: process.env.FINANCE_API_URL ? "env_stub_fallback" : "env_stub",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
