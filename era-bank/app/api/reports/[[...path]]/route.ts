import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "reports",
  entitlementModule: "banking_regreporting",
  logAction: "REPORTS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
