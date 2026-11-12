import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";

function text(value: unknown): string {
  if (Array.isArray(value)) return text(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The deleted Next proxy copied `x-organization-id` into the JSON body.
 * Handlers on this controller read `body.organizationId` and ignore the header.
 * Body wins. Then the query. Then the header.
 */
@Injectable()
export class MdmOrganizationBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    const body = req.body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const record = body as { organizationId?: unknown };
      if (!text(record.organizationId)) {
        const fromQuery = text(req.query?.organizationId);
        const fromHeader = text(req.headers["x-organization-id"]);
        const organizationId = fromQuery || fromHeader;
        if (organizationId) record.organizationId = organizationId;
      }
    }
    return next.handle();
  }
}
