async function readCreditFromFinance(
  counterpartyId: string,
  authHeader: string | null,
): Promise<{ creditLimit: number; source: string } | null> {
  const base = process.env.FINANCE_API_URL?.replace(/\/$/, "");
  if (!base) return null;

  const res = await fetch(`${base}/counterparties/${counterpartyId}`, {
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    cache: "no-store",
  }).catch(() => null);

  if (!res?.ok) return null;
  const data = (await res.json()) as {
    creditLimit?: number | string | null;
    global?: { creditLimit?: number | string | null };
  };
  const raw = data.creditLimit ?? data.global?.creditLimit;
  if (raw == null || raw === "") return null;
  const creditLimit = Number(raw);
  if (!Number.isFinite(creditLimit)) return null;
  return { creditLimit, source: "finance_api" };
}

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

export { readCreditFromFinance, readCreditLimitStub };
