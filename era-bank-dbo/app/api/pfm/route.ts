import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

type DboAccount = {
  id: string;
  balanceMinor?: string | number | bigint;
  currency?: string;
};

const STUB_CATEGORIES = [
  { code: "FOOD", label: "Food & dining", amountMinor: "12500" },
  { code: "TRANSPORT", label: "Transport", amountMinor: "4200" },
  { code: "UTILITIES", label: "Utilities", amountMinor: "8900" },
  { code: "OTHER", label: "Other", amountMinor: "15600" },
];

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const accounts = (await engineDboFetch(dboPaths.accounts, {
      customerJwt: auth.session.customerJwt ?? undefined,
    })) as DboAccount[];

    const list = Array.isArray(accounts) ? accounts : [];
    const totalBalanceMinor = list.reduce((sum, a) => {
      const v = a.balanceMinor ?? 0;
      return sum + BigInt(String(v));
    }, BigInt(0));

    return jsonOk({
      totalBalanceMinor: totalBalanceMinor.toString(),
      accountCount: list.length,
      spendCategories: STUB_CATEGORIES,
      note: "PFM lab scaffold (XO-4) — spend categories are stub aggregates until engine categorization ships",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
