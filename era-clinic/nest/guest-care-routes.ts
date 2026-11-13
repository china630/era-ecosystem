import type { Express, Request as ExpressRequest, Response as ExpressResponse } from "express";
import { runWithSatelliteTenant } from "@era/satellite-kit";
import { listPublishedPortalLabResults } from "@/domain/portal/portal-session.service";
import { prisma } from "@/lib/prisma";
import {
  assertGuestCareServiceToken,
  parseGuestCarePersonParams,
} from "./guest-care-auth";

/**
 * Hotel guest-app Care proxy target (HOT-GUEST-APP-05/06).
 * Published results only — mirrors portal semantics. No staff session.
 * Results never include draft / other-person / cross-org rows.
 * Prisma tenant extension requires runWithSatelliteTenant.
 */
export function registerGuestCareRoutes(http: Express) {
  http.get("/api/internal/v1/guest-care/timetable", async (req: ExpressRequest, res: ExpressResponse) => {
    if (!assertGuestCareServiceToken(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = parseGuestCarePersonParams(req.query);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { globalPersonId, organizationId } = parsed;
    const body = await runWithSatelliteTenant({ organizationId }, async () => {
      const patients = await prisma.patientRef.findMany({
        where: { globalPersonId, organizationId },
        select: { id: true },
        take: 20,
      });
      if (patients.length === 0) return { items: [] };
      const orders = await prisma.procedureOrder.findMany({
        where: { organizationId, patientRefId: { in: patients.map((p) => p.id) } },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          procedureName: true,
          resource: { select: { name: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 100,
      });
      return {
        items: orders.map((o) => ({
          id: o.id,
          scheduledAt: o.scheduledAt.toISOString(),
          procedureName: o.procedureName,
          room: o.resource?.name ?? null,
          status: o.status,
        })),
      };
    });
    res.json(body);
  });

  http.get("/api/internal/v1/guest-care/results", async (req: ExpressRequest, res: ExpressResponse) => {
    if (!assertGuestCareServiceToken(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = parseGuestCarePersonParams(req.query);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { globalPersonId, organizationId } = parsed;
    const body = await runWithSatelliteTenant({ organizationId }, async () => {
      const patients = await prisma.patientRef.findMany({
        where: { globalPersonId, organizationId },
        select: { id: true },
        take: 50,
      });
      if (patients.length === 0) return { items: [] };
      const items = await listPublishedPortalLabResults(patients.map((p) => p.id));
      return {
        items: items.map((row) => ({
          id: row.id,
          title: row.testCode,
          publishedAt: (row.publishedAt ?? row.completedAt ?? new Date()).toISOString(),
        })),
      };
    });
    res.json(body);
  });

  http.get("/api/internal/v1/guest-care/episodes", async (req: ExpressRequest, res: ExpressResponse) => {
    if (!assertGuestCareServiceToken(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = parseGuestCarePersonParams(req.query);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { globalPersonId, organizationId } = parsed;
    const body = await runWithSatelliteTenant({ organizationId }, async () => {
      const episodes = await prisma.clinicalEpisode.findMany({
        where: {
          organizationId,
          OR: [{ globalPersonId }, { patientRef: { globalPersonId, organizationId } }],
        },
        select: { id: true, openedAt: true, closedAt: true, programCode: true },
        orderBy: { openedAt: "desc" },
        take: 50,
      });
      return {
        items: episodes.map((e) => ({
          id: e.id,
          label: e.programCode ?? e.id,
          startedAt: e.openedAt.toISOString(),
          closedAt: e.closedAt?.toISOString() ?? null,
        })),
      };
    });
    res.json(body);
  });

  http.get("/api/internal/v1/program-template-codes", async (req: ExpressRequest, res: ExpressResponse) => {
    if (!assertGuestCareServiceToken(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const organizationId = String(req.query.organizationId ?? "").trim();
    if (!organizationId) {
      res.status(400).json({ error: "missing_params" });
      return;
    }
    const codes = await runWithSatelliteTenant({ organizationId }, async () => {
      const rows = await prisma.programTemplate.findMany({
        where: { organizationId, isCurrent: true },
        select: { code: true },
      });
      return [...new Set(rows.map((row) => row.code.trim().toUpperCase()).filter(Boolean))];
    });
    res.json({ codes });
  });
}
