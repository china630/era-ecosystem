import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "markets",
  entitlementModule: "banking_markets",
  logAction: "MARKETS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
