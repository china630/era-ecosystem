import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "islamic",
  entitlementModule: "banking_islamic",
  logAction: "ISLAMIC_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
