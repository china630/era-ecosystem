import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";

function readCreditLimitStub(counterpartyId: string) {
  const defaultLimit = Number(process.env.WHOLESALE_CREDIT_LIMIT_STUB ?? "10000");
  const overridesRaw = process.env.WHOLESALE_CREDIT_LIMIT_OVERRIDES;
  if (overridesRaw) {
    try {
      const overrides = JSON.parse(overridesRaw) as Record<string, number>;
      if (overrides[counterpartyId] != null) {
        return overrides[counterpartyId];
      }
    } catch {
      // fall through to default
    }
  }
  return defaultLimit;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const counterpartyId = url.searchParams.get("counterpartyId");
    if (!counterpartyId) {
      return jsonError("counterpartyId query param is required", 400);
    }

    const creditLimit = readCreditLimitStub(counterpartyId);
    return jsonOk({
      counterpartyId,
      creditLimit,
      currency: "AZN",
      source: "env_stub",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
