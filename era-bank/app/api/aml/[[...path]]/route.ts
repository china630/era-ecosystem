import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "aml",
  entitlementModule: "banking_aml",
  logAction: "AML_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
