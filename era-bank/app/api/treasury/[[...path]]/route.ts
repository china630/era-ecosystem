import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "treasury",
  entitlementModule: "banking_treasury",
  logAction: "TREASURY_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
