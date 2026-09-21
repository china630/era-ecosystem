import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  enginePath,
  forwardToBankCore,
} from "@/lib/engine-client";
import { getRouteSession, jsonError } from "@/lib/api-utils";
import { requiredPermissionsForEngineProxy } from "@/lib/auth/bff-permission-map";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { permissionsForUserId } from "@/lib/auth/bank-permission.service";
import { sanitizeLimitsJson } from "@/lib/auth/permissions";
import type { SatelliteSessionPayload } from "@era/satellite-kit";

type ProxyOptions = {
  enginePrefix: string;
  entitlementModule?: string;
  logAction?: string;
};

function deriveSemanticAction(
  enginePrefix: string,
  method: string,
  pathSegments: string[] | undefined,
): string {
  const area = enginePrefix.toUpperCase().replace(/-/g, "_");
  if (method === "GET") return `${area}_READ`;
  if (method === "DELETE") return `${area}_DELETE`;

  const tail = pathSegments?.[pathSegments.length - 1] ?? "";
  const prev = pathSegments?.[pathSegments.length - 2] ?? "";

  if (tail === "approve") return `${area}_APPROVE`;
  if (tail === "reject") return `${area}_REJECT`;
  if (tail === "reverse") return `${area}_REVERSE`;
  if (tail === "submit") return `${area}_SUBMIT`;
  if (tail === "close") return `${area}_CLOSE`;
  if (tail === "disburse") return `${area}_DISBURSE`;
  if (tail === "repay") return `${area}_REPAY`;
  if (tail === "rollover") return `${area}_ROLLOVER`;
  if (tail === "run") return `${area}_RUN`;
  if (tail === "cash-deposit") return "POSTING_CASH_DEPOSIT";
  if (tail === "cash-withdrawal") return "POSTING_CASH_WITHDRAWAL";
  if (tail === "internal-transfer") return "POSTING_INTERNAL_TRANSFER";
  if (tail === "cross-branch-withdrawal") return "POSTING_CROSS_BRANCH";
  if (tail === "holds") return `${area}_HOLD_PLACE`;
  if (prev === "holds" && method === "DELETE") return `${area}_HOLD_RELEASE`;

  if (method === "POST") return `${area}_CREATE`;
  if (method === "PATCH" || method === "PUT") return `${area}_UPDATE`;
  return `${area}_${method}`;
}

function extractAmountMinor(body: string | null): number | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed.amountMinor === "number") return parsed.amountMinor;
    if (typeof parsed.amount === "number") return parsed.amount;
    return null;
  } catch {
    return null;
  }
}

async function denyIfOverDebitLimit(
  opsUserId: string,
  body: string | null,
): Promise<Response | null> {
  const amountMinor = extractAmountMinor(body);
  if (amountMinor == null || amountMinor <= 0) return null;
  const user = await prisma.opsUser.findUnique({
    where: { id: opsUserId },
    include: { opsRole: true },
  });
  if (!user) return jsonError("Unauthorized", 401);
  const limits = sanitizeLimitsJson(
    (user.opsRole.limitsJson ?? {}) as Record<string, unknown>,
  );
  const cap = limits.maxDebitMinor;
  if (typeof cap === "number" && amountMinor > cap) {
    return jsonError("Amount exceeds role debit limit", 403);
  }
  return null;
}

async function sessionWithDbPermissions(
  session: SatelliteSessionPayload,
): Promise<SatelliteSessionPayload> {
  const permissions = await permissionsForUserId(session.sub);
  return { ...session, permissions };
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[] | undefined,
  options: ProxyOptions,
): Promise<Response> {
  const session = await getRouteSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const authed = await sessionWithDbPermissions(session);
  const required = requiredPermissionsForEngineProxy({
    enginePrefix: options.enginePrefix,
    method: request.method,
    pathSegments,
  });
  const denied = denyUnlessAnyPermission(authed, required);
  if (denied) return denied;

  const search = request.nextUrl.search;
  const engineApiPath = enginePath(options.enginePrefix, pathSegments, search);
  const idempotencyKey =
    request.headers.get("idempotency-key") ??
    request.headers.get("x-idempotency-key") ??
    undefined;

  let body: string | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    const limitDenied = await denyIfOverDebitLimit(session.sub, body);
    if (limitDenied) return limitDenied;
  }

  const res = await forwardToBankCore({
    method: request.method,
    path: engineApiPath,
    body,
    idempotencyKey,
    entitlementModule: options.entitlementModule,
    opsUserId: session.sub,
  });

  if (request.method !== "GET" && request.method !== "HEAD" && res.ok) {
    const action =
      options.logAction && !options.logAction.endsWith("_PROXY")
        ? options.logAction
        : deriveSemanticAction(options.enginePrefix, request.method, pathSegments);

    const refId =
      pathSegments?.find((s) => s.length > 8 && !s.includes("-")) ??
      pathSegments?.[pathSegments.length - 1];

    let metadataJson: Prisma.InputJsonValue | undefined;
    if (body) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        metadataJson = {
          method: request.method,
          path: engineApiPath,
          amountMinor: parsed.amountMinor,
          accountId: parsed.accountId ?? parsed.debtorAccountId,
        } as Prisma.InputJsonValue;
      } catch {
        metadataJson = { method: request.method, path: engineApiPath } as Prisma.InputJsonValue;
      }
    }

    await prisma.opsActionLog
      .create({
        data: {
          opsUserId: session.sub,
          action,
          refType: options.enginePrefix,
          refId: refId ?? null,
          metadataJson,
        },
      })
      .catch(() => undefined);
  }

  return res;
}

export function createEngineProxyRoute(options: ProxyOptions) {
  async function handler(
    request: NextRequest,
    ctx: { params: Promise<{ path?: string[] }> },
  ) {
    const params = await ctx.params;
    return proxyRequest(request, params.path, options);
  }

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
