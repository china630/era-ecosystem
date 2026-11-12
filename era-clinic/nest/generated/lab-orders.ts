import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveClinicDataScope, labOrderAssignedToPractitionerWhere } from "@/lib/auth/clinic-data-scope";
import { countLabOrders, createLabOrderWithItems, ensurePatientRefForLabOrder, findLabOrdersPage, findVisitById } from "@/domain/lab/lab-order-write.service";
import { labOrderVisibleToLabWhere } from "@/domain/lab/lab-order-pay-gate";
import { labOrderLaneWhere } from "@/domain/lab/lab-order-lane";
import { findDiagnosticServiceIdsByModality, loadDiagnosticLaneCodes, loadMenuSurfaceCodes } from "@/domain/lab/lab-order-lane.server";
import { stampEpisodeOnCreate } from "@/domain/sanatorium/episode-stamp";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  patientRefCode: z.string(),
  patientFullName: z.string(),
  testCode: z.string().optional(),
  testCodes: z.array(z.string()).optional(),
  visitId: z.string().optional(),
  amountNet: z.number().nonnegative().optional(),
  source: z.enum(["IN_HOUSE", "EXTERNAL"]).optional(),
  resultDate: z.string().optional(),
  results: z
    .array(
      z.object({
        code: z.string().optional(),
        analyte: z.string().optional(),
        value: z.string(),
        unit: z.string().optional(),
        refMin: z.string().optional(),
        refMax: z.string().optional(),
        normTextEn: z.string().optional(),
        normTextRu: z.string().optional(),
        normTextAz: z.string().optional(),
        boundKind: z
          .enum(["INTERVAL", "UPPER_ONLY", "LOWER_ONLY", "QUALITATIVE", "ZONES"])
          .optional(),
        flag: z.string().optional(),
      }),
    )
    .optional(),
  fasting: z.boolean().optional(),
  confirmRepeat: z.boolean().optional(),
});

const querySchema = z.object({
  status: z
    .enum([
      "ORDERED",
      "COLLECTED",
      "IN_PROGRESS",
      "RESULT_READY",
      "PUBLISHED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  criticalOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  modality: z.string().optional(),
  kinds: z.string().optional(),
  unclassified: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  patientRefId: z.string().optional(),
  q: z.string().optional(),
  room: z.string().optional(),
  sort: z.enum(["patient", "status", "amount", "created"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  includeCancelled: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/lab-orders", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;

    const url = new URL(req.url);
    const query = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      criticalOnly: url.searchParams.get("criticalOnly") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      modality: url.searchParams.get("modality") ?? undefined,
      kinds: url.searchParams.get("kinds") ?? undefined,
      unclassified: url.searchParams.get("unclassified") ?? undefined,
      patientRefId: url.searchParams.get("patientRefId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      room: url.searchParams.get("room") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
      includeCancelled: url.searchParams.get("includeCancelled") ?? undefined,
    });

    const dataScope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL,
    );
    if (dataScope.mode === "ASSIGNED" && !dataScope.practitionerId) {
      return sendJson(httpRes, { data: [], total: 0, page: query.page, pageSize: query.pageSize });
    }

    const conditions: Prisma.LabOrderWhereInput[] = [
      labOrderVisibleToLabWhere(),
      { OR: [{ clinicalEpisodeId: null }, { episode: { status: "OPEN" } }] },
    ];
    if (dataScope.mode === "ASSIGNED" && dataScope.practitionerId) {
      conditions.push(labOrderAssignedToPractitionerWhere(dataScope.practitionerId));
    }
    if (!query.includeCancelled && !query.status) {
      conditions.push({ status: { not: "CANCELLED" } });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.patientRefId) conditions.push({ patientRefId: query.patientRefId });
    if (query.dateFrom || query.dateTo) {
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
      const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
      if (dateFrom && Number.isNaN(dateFrom.getTime())) {
        return sendJson(httpRes, { error: "Invalid dateFrom" }, 400);
      }
      if (dateTo && Number.isNaN(dateTo.getTime())) {
        return sendJson(httpRes, { error: "Invalid dateTo" }, 400);
      }
      const range = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
      conditions.push({
        OR: [
          { collectedAt: range },
          { AND: [{ collectedAt: null }, { createdAt: range }] },
        ],
      });
    }
    if (query.modality) {
      const serviceIds = await findDiagnosticServiceIdsByModality(query.modality);
      conditions.push({
        items: { some: { diagnosticServiceId: { in: serviceIds } } },
      });
    }
    const surfaces = await loadMenuSurfaceCodes();
    const laneWhere = labOrderLaneWhere({
      kinds: (query.kinds ?? "").split(","),
      unclassified: query.unclassified,
      diagnosticCodes: await loadDiagnosticLaneCodes(),
      surfaceDiagnosticCodes: surfaces.diagnostic,
      surfaceLabCodes: surfaces.lab,
    });
    if (laneWhere) conditions.push(laneWhere);
    if (query.criticalOnly) {
      conditions.push({
        items: { some: { results: { some: { flag: "CRITICAL" } } } },
      });
    }
    if (query.room?.trim()) {
      const room = query.room.trim();
      conditions.push({
        OR: [
          { episode: { roomNumber: { equals: room, mode: "insensitive" } } },
          { visit: { roomNumber: { equals: room, mode: "insensitive" } } },
        ],
      });
    }
    if (query.q?.trim()) {
      const needle = query.q.trim();
      conditions.push({
        patientRef: {
          OR: [
            { fullName: { contains: needle, mode: "insensitive" } },
            { refCode: { contains: needle, mode: "insensitive" } },
          ],
        },
      });
    }

    const where: Prisma.LabOrderWhereInput | undefined = conditions.length
      ? { AND: conditions }
      : undefined;

    const orderBy: Prisma.LabOrderOrderByWithRelationInput | Prisma.LabOrderOrderByWithRelationInput[] =
      query.sort === "patient"
        ? [{ patientRef: { fullName: query.sortDir ?? "asc" } }]
        : query.sort === "status"
          ? [{ status: query.sortDir ?? "asc" }]
          : query.sort === "amount"
            ? [{ amountNet: query.sortDir ?? "asc" }]
            : query.sort === "created"
              ? [
                  { collectedAt: query.sortDir ?? "desc" },
                  { resultDate: query.sortDir ?? "desc" },
                  { createdAt: query.sortDir ?? "desc" },
                ]
              : [
                  { patientRef: { fullName: "asc" } },
                  { collectedAt: "desc" },
                  { createdAt: "desc" },
                ];
    const [total, orders] = await Promise.all([
      countLabOrders(where),
      findLabOrdersPage({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return sendJson(httpRes, { data: orders, total, page: query.page, pageSize: query.pageSize });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/lab-orders", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (denied) return denied;

    const body = createSchema.parse(httpReq.body);
    const codes =
      body.testCodes?.length
        ? body.testCodes
        : body.testCode
          ? [body.testCode]
          : null;
    if (!codes?.length) {
      return sendJson(httpRes, { error: "testCode or testCodes required" }, 400);
    }

    const organizationId = requestOrganizationId();
    const patient = await ensurePatientRefForLabOrder({
      organizationId,
      refCode: body.patientRefCode,
      fullName: body.patientFullName,
    });

    if (body.visitId) {
      const visit = await findVisitById(body.visitId);
      if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);
    }

    const source = body.source ?? "IN_HOUSE";
    let resultDate: Date | undefined;
    if (source === "EXTERNAL") {
      if (!body.resultDate) {
        return sendJson(httpRes, { error: "resultDate required for EXTERNAL lab orders" }, 400);
      }
      resultDate = new Date(body.resultDate);
      if (Number.isNaN(resultDate.getTime())) {
        return sendJson(httpRes, { error: "Invalid resultDate" }, 400);
      }
      const ageMs = Date.now() - resultDate.getTime();
      if (ageMs > 90 * 24 * 60 * 60 * 1000) {
        return sendJson(httpRes, { error: "External lab results older than 90 days are not accepted" }, 400);
      }
      if (!body.results?.length) {
        return sendJson(httpRes, { error: "results required for EXTERNAL lab orders" }, 400);
      }
    }

    const clinicalEpisodeId = await stampEpisodeOnCreate({
      patientRefId: patient.id,
    });
    const order = await createLabOrderWithItems({
      patientRefId: patient.id,
      visitId: body.visitId,
      clinicalEpisodeId: clinicalEpisodeId ?? undefined,
      codes,
      amountNet: body.amountNet,
      source,
      resultDate,
      fasting: body.fasting,
      resultLines: body.results,
      confirmRepeat: body.confirmRepeat,
    });

    return sendJson(httpRes, order, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
