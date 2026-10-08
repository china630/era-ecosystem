import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { defer, firstValueFrom } from "rxjs";
import { TenantContextInterceptor } from "./tenant-context.interceptor";
import { getTenantContext } from "./tenant-context";

function httpContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("TenantContextInterceptor", () => {
  it("keeps the JWT org in ALS when the handler runs on subscribe", async () => {
    const interceptor = new TenantContextInterceptor();
    const req = {
      originalUrl: "/api/fx/rates",
      user: { userId: "u1", organizationId: "org-1", isSuperAdmin: false },
    };
    const next: CallHandler = {
      handle: () =>
        defer(async () => {
          await Promise.resolve();
          return getTenantContext();
        }),
    };

    const observable = interceptor.intercept(httpContext(req), next);
    expect(getTenantContext()).toBeUndefined();

    const seen = await firstValueFrom(observable);
    expect(seen).toEqual({ organizationId: "org-1", skipTenantFilter: false });
  });

  it("skips the tenant filter only for super-admin /api/admin routes", async () => {
    const interceptor = new TenantContextInterceptor();
    const next: CallHandler = { handle: () => defer(async () => getTenantContext()) };

    const admin = await firstValueFrom(
      interceptor.intercept(
        httpContext({
          originalUrl: "/api/admin/orgs",
          user: { userId: "sa", organizationId: "org-1", isSuperAdmin: true },
        }),
        next,
      ),
    );
    expect(admin).toEqual({ organizationId: "org-1", skipTenantFilter: true });

    const ops = await firstValueFrom(
      interceptor.intercept(
        httpContext({
          originalUrl: "/api/reporting/dashboard",
          user: { userId: "sa", organizationId: "org-1", isSuperAdmin: true },
        }),
        next,
      ),
    );
    expect(ops).toEqual({ organizationId: "org-1", skipTenantFilter: false });
  });
});
