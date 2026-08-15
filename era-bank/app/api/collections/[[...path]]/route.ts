import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "collections",
  entitlementModule: "banking_collections",
  logAction: "COLLECTIONS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
