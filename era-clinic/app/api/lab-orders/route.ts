import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  patientRefCode: z.string(),
  patientFullName: z.string(),
  testCode: z.string().optional(),
  testCodes: z.array(z.string()).optional(),
  visitId: z.string().optional(),
  amountNet: z.number().nonnegative().default(0),
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
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
    });

    const orders = await prisma.labOrder.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: { patientRef: true, visit: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(orders);
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

    let patient = await prisma.patientRef.findUnique({
      where: { refCode: body.patientRefCode },
    });
    if (!patient) {
      patient = await prisma.patientRef.create({
        data: {
          refCode: body.patientRefCode,
          fullName: body.patientFullName,
        },
      });
    }

    if (body.visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: body.visitId },
      });
      if (!visit) return jsonError("Visit not found", 404);
    }

    const order = await prisma.labOrder.create({
      data: {
        patientRefId: patient.id,
        visitId: body.visitId,
        testCode: codes.join(","),
        amountNet: body.amountNet,
      },
      include: { patientRef: true, visit: true },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
