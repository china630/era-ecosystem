import { NextRequest, NextResponse } from "next/server";
import { ORCH_API_URL } from "../../../../../../lib/orch-api";

/**
 * Align with MdmService.assertServiceToken → assertInternalServiceToken:
 * ORCHESTRATOR_INTERNAL_SERVICE_TOKEN (fallback CONTROL_PLANE_SERVICE_TOKEN).
 * Prefer MDM_INTERNAL_SERVICE_TOKEN when set to the same value in ops.
 */
const MDM_SERVICE_TOKEN =
  process.env.MDM_INTERNAL_SERVICE_TOKEN ??
  process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN ??
  process.env.CONTROL_PLANE_SERVICE_TOKEN ??
  process.env.SATELLITE_EVENT_SERVICE_TOKEN ??
  "";

/** SEC-TOK-02: require caller JWT; inject service token via x-service-token only. */
async function proxy(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const callerAuth = request.headers.get("authorization")?.trim();
  if (!callerAuth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subpath = path.join("/");
  const url = new URL(
    `${ORCH_API_URL.replace(/\/$/, "")}/internal/v1/mdm/persons/${subpath}`,
  );
  request.nextUrl.searchParams.forEach((v, k) => {
    url.searchParams.set(k, v);
  });

  const orgId = request.headers.get("x-organization-id")?.trim();
  // GET/PATCH hr-profile require organizationId query (not header alone).
  if (orgId && !url.searchParams.has("organizationId")) {
    url.searchParams.set("organizationId", orgId);
  }

  const headers = new Headers();
  headers.set("Authorization", callerAuth);
  if (MDM_SERVICE_TOKEN) {
    headers.set("x-service-token", MDM_SERVICE_TOKEN);
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "MDM service token not configured" },
      { status: 503 },
    );
  }
  if (orgId) headers.set("x-organization-id", orgId);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  let bodyText: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    bodyText = await request.text();
    if (orgId && bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        if (!parsed.organizationId) {
          parsed.organizationId = orgId;
          bodyText = JSON.stringify(parsed);
        }
      } catch {
        /* pass through */
      }
    }
  }

  const init: RequestInit = { method: request.method, headers, body: bodyText };
  const res = await fetch(url.toString(), init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}
