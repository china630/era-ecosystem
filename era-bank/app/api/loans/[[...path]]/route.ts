import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "loans",
  entitlementModule: "banking_loans",
  logAction: "LOANS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
