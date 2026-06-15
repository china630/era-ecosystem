import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "postings",
  entitlementModule: "banking_core",
  logAction: "POSTINGS_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
