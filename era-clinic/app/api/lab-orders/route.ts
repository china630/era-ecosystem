import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import { stampEpisodeOnCreate } from "@/domain/sanatorium/episode-stamp";

const createSchema = z.object({
  patientRefCode: z.string(),
  patientFullName: z.string(),
  testCode: z.string().optional(),
  testCodes: z.array(z.string()).optional(),
  visitId: z.string().optional(),
  amountNet: z.number().nonnegative().default(0),
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
  patientRefId: z.string().optional(),
  q: z.string().optional(),
  includeCancelled: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      criticalOnly: url.searchParams.get("criticalOnly") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      modality: url.searchParams.get("modality") ?? undefined,
      patientRefId: url.searchParams.get("patientRefId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      includeCancelled: url.searchParams.get("includeCancelled") ?? undefined,
    });

    const conditions: Prisma.LabOrderWhereInput[] = [];
    if (!query.includeCancelled && !query.status) {
      conditions.push({ status: { not: "CANCELLED" } });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.patientRefId) conditions.push({ patientRefId: query.patientRefId });
    if (query.dateFrom || query.dateTo) {
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
      const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
      if (dateFrom && Number.isNaN(dateFrom.getTime())) {
        return jsonError("Invalid dateFrom", 400);
      }
      if (dateTo && Number.isNaN(dateTo.getTime())) {
        return jsonError("Invalid dateTo", 400);
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
      const services = await prisma.diagnosticService.findMany({
        where: { modality: { code: query.modality } },
        select: { id: true },
      });
      conditions.push({
        items: { some: { diagnosticServiceId: { in: services.map((s) => s.id) } } },
      });
    }
    if (query.criticalOnly) {
      conditions.push({
        items: { some: { results: { some: { flag: "CRITICAL" } } } },
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

    const [total, orders] = await Promise.all([
      prisma.labOrder.count({ where }),
      prisma.labOrder.findMany({
        where,
        include: {
          patientRef: true,
          visit: true,
          items: {
            include: {
              diagnosticService: { include: { modality: true } },
              results: true,
            },
          },
        },
        orderBy: [{ collectedAt: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return jsonOk({ data: orders, total, page: query.page, pageSize: query.pageSize });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const codes =
      body.testCodes?.length
        ? body.testCodes
        : body.testCode
          ? [body.testCode]
          : null;
    if (!codes?.length) {
      return jsonError("testCode or testCodes required", 400);
    }

    const organizationId = requestOrganizationId();
    let patient = await prisma.patientRef.findFirst({
      where: { organizationId, refCode: body.patientRefCode },
    });
    if (!patient) {
      patient = await prisma.patientRef.create({
        data: {
          organizationId,
          refCode: body.patientRefCode,
          fullName: body.patientFullName,
        },
      });
    }
    if (!patient) throw new Error("Failed to ensure patient ref");

    if (body.visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: body.visitId },
      });
      if (!visit) return jsonError("Visit not found", 404);
    }

    const source = body.source ?? "IN_HOUSE";
    let resultDate: Date | undefined;
    if (source === "EXTERNAL") {
      if (!body.resultDate) {
        return jsonError("resultDate required for EXTERNAL lab orders", 400);
      }
      resultDate = new Date(body.resultDate);
      if (Number.isNaN(resultDate.getTime())) {
        return jsonError("Invalid resultDate", 400);
      }
      const ageMs = Date.now() - resultDate.getTime();
      if (ageMs > 90 * 24 * 60 * 60 * 1000) {
        return jsonError("External lab results older than 90 days are not accepted", 400);
      }
      if (!body.results?.length) {
        return jsonError("results required for EXTERNAL lab orders", 400);
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

    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
