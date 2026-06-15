import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "eod",
  entitlementModule: "banking_core",
  logAction: "EOD_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
