import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "accounts",
  entitlementModule: "banking_core",
  logAction: "ACCOUNTS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
