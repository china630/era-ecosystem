import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "branches",
  entitlementModule: "banking_core",
  logAction: "BRANCHES_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
