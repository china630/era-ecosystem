import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "payments",
  entitlementModule: "banking_payments",
  logAction: "PAYMENTS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
