import { Controller, Get, HttpCode, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp } from "../../bridge";
import {
  IndustryModuleInactiveError,
  requireSatelliteModule,
  satelliteOrganizationId,
  verifyGuestIdentityToken,
  verifyGuestQrToken,
} from "@era/satellite-kit";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  findPatientRefsByGlobalPersonId,
  listPublishedPortalLabResults,
  listPortalAppointments,
} from "@/domain/portal/portal-session.service";

async function resolvePortalIdentity(token: string) {
  const viaOrchestrator = await verifyGuestQrToken(token);
  if (viaOrchestrator?.globalPersonId) {
    if (viaOrchestrator.expiresAt < Math.floor(Date.now() / 1000)) {
      return { error: "token expired" as const, status: 410 as const };
    }
    return { identity: viaOrchestrator };
  }

  const local = verifyGuestIdentityToken(token);
  if (local?.globalPersonId) {
    if (local.expiresAt && local.expiresAt < Math.floor(Date.now() / 1000)) {
      return { error: "token expired" as const, status: 410 as const };
    }
    return { identity: local };
  }

  return { error: "invalid or expired token" as const, status: 401 as const };
}

@Controller()
export class PortalSessionController {
  @Get("api/portal/session")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const token = url.searchParams.get("token")?.trim();
      if (!token || token.length < 16) {
        throw new HttpException({ error: "token required" }, 400);
      }

      const resolved = await resolvePortalIdentity(token);
      if ("error" in resolved) {
        throw new HttpException({ error: resolved.error }, resolved.status);
      }

      const { identity } = resolved;
      const patients = await findPatientRefsByGlobalPersonId(identity.globalPersonId);
      const orgIds = [
        ...new Set(patients.map((p) => p.organizationId?.trim()).filter((id): id is string => Boolean(id))),
      ];
      if (orgIds.length === 0) {
        try {
          const bound = satelliteOrganizationId();
          if (bound) orgIds.push(bound);
        } catch {
          /* SHARED without a bind — fail closed below */
        }
      }
      const entitledOrgs: string[] = [];
      for (const organizationId of orgIds) {
        try {
          await requireSatelliteModule("platform_portal", { organizationId });
          entitledOrgs.push(organizationId);
        } catch (err) {
          if (err instanceof HttpException) throw err;
          if (!(err instanceof IndustryModuleInactiveError)) throw err;
        }
      }
      if (entitledOrgs.length === 0) {
        throw new HttpException({ error: "portal_module_inactive" }, 403);
      }
      const entitled = new Set(entitledOrgs);
      const entitledPatients = patients.filter((p) => entitled.has(p.organizationId));
      const patientIds = entitledPatients.map((p) => p.id);
      const patientName = entitledPatients[0]?.fullName ?? "";

      if (patientIds.length === 0) {
        return {
          globalPersonId: identity.globalPersonId,
          expiresAt: identity.expiresAt,
          patientName,
          appointments: [],
          labResults: [],
        };
      }

      const [labResults, appointments] = await Promise.all([
        listPublishedPortalLabResults(patientIds),
        listPortalAppointments(patientIds, entitledOrgs),
      ]);

      await recordClinicAudit(
        { request: httpReq },
        "portal",
        identity.globalPersonId,
        "PORTAL_ACCESS",
        { labCount: labResults.length, appointmentCount: appointments.length },
      );

      return {
        globalPersonId: identity.globalPersonId,
        expiresAt: identity.expiresAt,
        patientName,
        appointments,
        labResults,
      };
    });
  }
}