import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  patientRefCode: z.string(),
  patientFullName: z.string(),
  testCode: z.string(),
  amountNet: z.number().nonnegative().default(0),
});

export async function GET() {
  try {
    const orders = await prisma.labOrder.findMany({
      include: { patientRef: true },
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

    const order = await prisma.labOrder.create({
      data: {
        patientRefId: patient.id,
        testCode: body.testCode,
        amountNet: body.amountNet,
      },
      include: { patientRef: true },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
