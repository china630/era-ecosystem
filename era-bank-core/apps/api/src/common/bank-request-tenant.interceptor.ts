import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { enterSatelliteTenant, runWithSatelliteTenant, satelliteRuntimeConfig } from "@era/satellite-kit";
import { Observable } from "rxjs";
import {
  isBankRequestTenantExempt,
  parseBankRequestOrganizationId,
} from "./parse-bank-request-org";

/**
 * SHARED-capable request tenant: BFF / DBO send X-Organization-Id.
 * Appliance without the header keeps process bind (BankOrgConfig / Prisma fallback).
 * SHARED without the header is fail-closed (do not silently use compose env).
 */
@Injectable()
export class BankRequestTenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      originalUrl?: string;
      url?: string;
    }>();
    const path = req.originalUrl ?? req.url ?? "";
    if (isBankRequestTenantExempt(path)) {
      return next.handle();
    }
    const organizationId = parseBankRequestOrganizationId(req.headers);
    const isShared = satelliteRuntimeConfig().deploymentTopology === "SHARED";
    if (isShared && !organizationId) {
      throw new BadRequestException("organizationId is required");
    }
    if (!organizationId) {
      return next.handle();
    }
    enterSatelliteTenant({ organizationId });
    return runWithSatelliteTenant({ organizationId }, () => next.handle());
  }
}
