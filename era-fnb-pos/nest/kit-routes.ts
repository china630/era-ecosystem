import type { Express, Request as ExpressRequest, Response as ExpressResponse } from "express";
import { createOrganizationBindHandlers, createRuntimeConfigHandlers } from "@era/satellite-kit";
import { GET as billingStatusGet } from "@era/satellite-kit/billing/status-route";
import { prisma } from "@/lib/prisma";
import { upsertFnbOrgSnapshot } from "@/lib/fnb-org-profile";
import { ensureKafeOpsSkeleton } from "@/lib/kafe-org-bootstrap";
import { runWithNestHttp, runWithStaffTenantIfPresent, sendRouteError, sendWebResponse } from "./bridge";

const runtimeConfig = createRuntimeConfigHandlers({
  getPrisma: () => prisma,
  onSharedOrgSnapshot: async (organizationId, snap) => {
    const profile = await upsertFnbOrgSnapshot(organizationId, snap);
    if (profile.edition.toLowerCase() === "kafe") {
      await ensureKafeOpsSkeleton({
        organizationId,
        cafeName: "",
        activeModules: profile.activeModules,
      });
    }
  },
});

const organizationBind = createOrganizationBindHandlers({
  getPrisma: () => prisma,
});

function webRequest(httpReq: ExpressRequest): Request {
  const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
  const headers = new Headers();
  for (const [key, value] of Object.entries(httpReq.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const method = httpReq.method ?? "GET";
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(httpReq.body ?? {});
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  return new Request(url, init);
}

function mount(
  http: Express,
  method: "get" | "post",
  path: string,
  handler: (request: Request) => Promise<Response>,
) {
  http[method](path, async (httpReq: ExpressRequest, httpRes: ExpressResponse) => {
    try {
      const web = await runWithNestHttp(httpReq, async () =>
        runWithStaffTenantIfPresent(httpReq, async () => handler(webRequest(httpReq))),
      );
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}

/** Kit re-exports the generator skips. Same handlers as the Next route files. */
export function registerKitRoutes(http: Express) {
  mount(http, "get", "/api/platform/billing-status", billingStatusGet);
  mount(http, "get", "/api/internal/v1/runtime-config", runtimeConfig.GET);
  mount(http, "post", "/api/internal/v1/runtime-config", runtimeConfig.POST);
  mount(http, "get", "/api/internal/v1/organization/bind", organizationBind.GET);
  mount(http, "post", "/api/internal/v1/organization/bind", organizationBind.POST);
}
