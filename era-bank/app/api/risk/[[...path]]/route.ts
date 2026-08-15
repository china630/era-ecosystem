import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "risk",
  entitlementModule: "banking_risk",
  logAction: "RISK_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
