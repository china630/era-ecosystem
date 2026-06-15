import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "deposits",
  entitlementModule: "banking_deposits",
  logAction: "DEPOSITS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
