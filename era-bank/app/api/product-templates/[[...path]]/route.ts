import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "product-templates",
  entitlementModule: "banking_core",
  logAction: "PRODUCT_TEMPLATES_PROXY",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
