import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "cif",
  entitlementModule: "banking_core",
  logAction: "CIF_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
