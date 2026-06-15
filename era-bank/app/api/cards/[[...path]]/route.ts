import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "cards",
  entitlementModule: "banking_cards",
  logAction: "CARDS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
