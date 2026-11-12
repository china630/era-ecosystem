import type { Response } from "express";
import { proxyRequest, type ProxyOptions } from "@/lib/bff-proxy";
import { runWithNestHttp, sendRouteError, sendWebResponse } from "./bridge";

const proxies: ProxyOptions[] = [
  { enginePrefix: "accounts", entitlementModule: "banking_core", logAction: "ACCOUNTS_PROXY" },
  { enginePrefix: "aml", entitlementModule: "banking_aml", logAction: "AML_PROXY" },
  { enginePrefix: "atm", entitlementModule: "banking_cards", logAction: "ATM_PROXY" },
  { enginePrefix: "branches", entitlementModule: "banking_core", logAction: "BRANCHES_PROXY" },
  { enginePrefix: "card-txns", entitlementModule: "banking_cards", logAction: "CARD_TXNS_PROXY" },
  { enginePrefix: "cards", entitlementModule: "banking_cards", logAction: "CARDS_PROXY" },
  { enginePrefix: "cash", entitlementModule: "banking_cash", logAction: "CASH_PROXY" },
  { enginePrefix: "cif", entitlementModule: "banking_core", logAction: "CIF_PROXY" },
  { enginePrefix: "collections", entitlementModule: "banking_collections", logAction: "COLLECTIONS_PROXY" },
  { enginePrefix: "deposits", entitlementModule: "banking_deposits", logAction: "DEPOSITS_PROXY" },
  { enginePrefix: "eod", entitlementModule: "banking_core", logAction: "EOD_PROXY" },
  { enginePrefix: "fees", entitlementModule: "banking_core", logAction: "FEES_PROXY" },
  { enginePrefix: "gl", entitlementModule: "banking_core", logAction: "GL_READ" },
  { enginePrefix: "islamic", entitlementModule: "banking_islamic", logAction: "ISLAMIC_PROXY" },
  { enginePrefix: "loans", entitlementModule: "banking_loans", logAction: "LOANS_PROXY" },
  { enginePrefix: "markets", entitlementModule: "banking_markets", logAction: "MARKETS_PROXY" },
  { enginePrefix: "payments", entitlementModule: "banking_payments", logAction: "PAYMENTS_PROXY" },
  { enginePrefix: "postings", entitlementModule: "banking_core", logAction: "POSTINGS_PROXY" },
  { enginePrefix: "product-templates", entitlementModule: "banking_core", logAction: "PRODUCT_TEMPLATES_PROXY" },
  { enginePrefix: "reports", entitlementModule: "banking_regreporting", logAction: "REPORTS_PROXY" },
  { enginePrefix: "risk", entitlementModule: "banking_risk", logAction: "RISK_PROXY" },
  { enginePrefix: "trade", entitlementModule: "banking_trade", logAction: "TRADE_PROXY" },
  { enginePrefix: "treasury", entitlementModule: "banking_treasury", logAction: "TREASURY_PROXY" },
  { enginePrefix: "wealth", entitlementModule: "banking_wealth", logAction: "WEALTH_PROXY" },
];

type ExpressReq = {
  method?: string;
  originalUrl?: string;
  url?: string;
  params?: { path?: string | string[] };
  body?: unknown;
  get?: (name: string) => string | undefined;
};

export function registerBankEngineProxies(http: { all: Function }) {
  for (const options of proxies) {
    const handler = async (httpReq: ExpressReq, httpRes: Response) => {
      try {
        const raw = httpReq.params?.path;
        const pathSegments = Array.isArray(raw) ? raw : typeof raw === "string" && raw ? raw.split("/") : [];
        const request = {
          method: httpReq.method ?? "GET",
          nextUrl: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1"),
          headers: { get: (name: string) => httpReq.get?.(name) ?? null },
          text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
        };
        const web = await runWithNestHttp(httpReq, () => proxyRequest(request as never, pathSegments, options));
        if (web instanceof Response) await sendWebResponse(httpRes, web);
      } catch (err) {
        await sendRouteError(httpRes, err);
      }
    };
    http.all(`/api/${options.enginePrefix}`, handler);
    http.all(`/api/${options.enginePrefix}/*path`, handler);
  }
}
