import { createEngineProxyRoute } from "@/lib/bff-proxy";

const proxy = createEngineProxyRoute({
  enginePrefix: "gl",
  entitlementModule: "banking_core",
  logAction: "GL_READ",
});

export const { GET, POST, PUT, PATCH, DELETE } = proxy;
