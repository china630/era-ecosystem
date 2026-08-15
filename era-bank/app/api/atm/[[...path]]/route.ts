import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "atm",
  entitlementModule: "banking_cards",
  logAction: "ATM_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
