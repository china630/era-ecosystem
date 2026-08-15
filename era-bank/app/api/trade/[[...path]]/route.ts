import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "trade",
  entitlementModule: "banking_trade",
  logAction: "TRADE_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
