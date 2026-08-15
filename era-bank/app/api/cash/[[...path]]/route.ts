import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "cash",
  entitlementModule: "banking_cash",
  logAction: "CASH_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
