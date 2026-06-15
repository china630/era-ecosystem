import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "card-txns",
  entitlementModule: "banking_cards",
  logAction: "CARD_TXNS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
