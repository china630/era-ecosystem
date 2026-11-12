import {
  All,
  CallHandler,
  Controller,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Req,
  Res,
} from "@nestjs/common";
import { tap } from "rxjs/operators";
import { verifySatelliteSession } from "../auth/session";
import {
  buildHttpMutationChanges,
  HTTP_MUTATION_ENTITY_TYPE,
  inferActorKind,
  inferMutationEntityId,
  isHttpMutationMethod,
  isMutationAuditExemptPath,
} from "../audit/mutation-audit-belt";
import {
  recordSatelliteAudit,
  type SatelliteAuditWriter,
} from "../audit/satellite-audit";
import { peekSatelliteRequestOrganizationId } from "../tenancy/satellite-tenant-context";

export type SatelliteMutationAuditRow = Parameters<SatelliteAuditWriter>[0] & {
  organizationId: string;
};

type Incoming = {
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined> & {
    get?(name: string): string | null | undefined;
  };
};

function header(req: Incoming, name: string): string | null {
  const headers = req.headers;
  if (!headers) return null;
  if (typeof headers.get === "function") {
    const value = headers.get(name);
    if (value) return value;
  }
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function requestPath(req: Incoming): string {
  const url = req.originalUrl ?? req.url ?? "";
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
}

function bearerOrCookieToken(req: Incoming): string | null {
  const authorization = header(req, "authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }
  const cookie = header(req, "cookie") ?? "";
  const name = process.env.AUTH_COOKIE_NAME ?? "era_session";
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

async function organizationAndUser(req: Incoming): Promise<{
  organizationId: string | null;
  userId: string | null;
}> {
  const peeked = peekSatelliteRequestOrganizationId() ?? null;
  const token = bearerOrCookieToken(req);
  if (!token) return { organizationId: peeked, userId: null };
  try {
    const session = await verifySatelliteSession(token);
    return {
      organizationId: session.organizationId ?? peeked,
      userId: session.sub,
    };
  } catch {
    return { organizationId: peeked, userId: null };
  }
}

/**
 * Layer A for satellite Nest. Runs for controller routes only.
 * Express `http.post` registrations never enter this interceptor.
 */
@Injectable()
export class SatelliteMutationAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly write: (row: SatelliteMutationAuditRow) => Promise<void>,
    private readonly extraExemptPrefixes: readonly string[] = [],
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const req = http.getRequest<Incoming>();
    const res = http.getResponse<{ statusCode?: number }>();
    const method = (req.method ?? "").toUpperCase();
    const path = requestPath(req);
    if (!isHttpMutationMethod(method) || isMutationAuditExemptPath(path, this.extraExemptPrefixes)) {
      return next.handle();
    }
    return next.handle().pipe(
      tap(() => {
        const status = res.statusCode ?? 200;
        if (status < 200 || status >= 400) return;
        void this.persist(req, method, path, status).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[satellite-mutation-audit] ${message}`);
        });
      }),
    );
  }

  private async persist(req: Incoming, method: string, path: string, status: number) {
    const actor = await organizationAndUser(req);
    if (!actor.organizationId) return;
    const organizationId = actor.organizationId;
    await recordSatelliteAudit(
      async (row) => {
        await this.write({ ...row, organizationId });
      },
      {
        userId: actor.userId,
        entityType: HTTP_MUTATION_ENTITY_TYPE,
        entityId: inferMutationEntityId(path),
        action: method,
        ipAddress:
          header(req, "x-forwarded-for")?.split(",")[0]?.trim() ??
          header(req, "x-real-ip") ??
          req.ip ??
          null,
        changes: buildHttpMutationChanges({
          method,
          path,
          statusCode: status,
          actorKind: inferActorKind({
            pathname: path,
            userActorHeader: header(req, "x-user-actor"),
          }),
          correlationId: header(req, "x-request-id") ?? header(req, "x-correlation-id"),
        }),
      },
    );
  }
}

type Routed = (
  req: { originalUrl?: string; url?: string },
  res: object,
  next: (err?: unknown) => void,
) => void;

/** Nest controller in front of the existing Express route table so the interceptor runs. */
export function createSatelliteApiController(router: Routed) {
  @Controller()
  class SatelliteApiController {
    @All(["api", "api/*path"])
    handle(
      @Req() req: { originalUrl?: string; url?: string },
      @Res({ passthrough: false }) res: { once?: (event: string, cb: () => void) => void },
    ) {
      const original = req.originalUrl ?? req.url ?? "/";
      (req as { url: string }).url = original;
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const done = (err?: unknown) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve();
        };
        res.once?.("finish", () => done());
        res.once?.("error", () => done(new Error("response error")));
        router(req, res, (err?: unknown) => done(err));
      });
    }
  }
  return SatelliteApiController;
}
