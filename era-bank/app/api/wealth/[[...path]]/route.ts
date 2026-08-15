import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "wealth",
  entitlementModule: "banking_wealth",
  logAction: "WEALTH_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
