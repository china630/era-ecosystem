import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  countClinicOpsWipe,
  runClinicOpsWipe,
} from "@/domain/ops/ops-wipe.service";

const confirmSchema = z.object({
  organizationId: z.string().uuid(),
  confirmPhrase: z.literal("WIPE"),
});

async function superAdminSession() {
  const session = await getSatelliteSession();
  if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    throw Object.assign(new Error("Forbidden: platform super admin only"), {
      status: 403,
    });
  }
  return session;
}

export async function GET() {
  try {
    const session = await superAdminSession();
    return jsonOk({
      organizationId: session.organizationId,
      counts: await countClinicOpsWipe(session.organizationId),
    });
  } catch (err) {
    return routeError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await superAdminSession();
    const body = confirmSchema.parse(await request.json());
    if (body.organizationId !== session.organizationId) {
      throw Object.assign(
        new Error("Organization changed since counts were loaded — reload the page"),
        { status: 409 },
      );
    }
    const deleted = await runClinicOpsWipe(session.organizationId);
    await recordClinicAudit(
      { userId: session.sub, request },
      "OpsWipe",
      session.organizationId,
      "WIPE",
      { deleted },
    );
    return jsonOk({
      organizationId: session.organizationId,
      deleted,
      counts: await countClinicOpsWipe(session.organizationId),
    });
  } catch (err) {
    return routeError(err);
  }
}

function routeError(err: unknown) {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status?: number }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    const message = err instanceof Error ? err.message : "Error";
    return jsonError(message, status);
  }
  return handleRouteError(err);
}
