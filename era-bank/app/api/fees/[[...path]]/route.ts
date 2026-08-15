import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "fees",
  entitlementModule: "banking_core",
  logAction: "FEES_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
