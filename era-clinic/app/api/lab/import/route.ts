import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  patientRefId: z.string(),
  testCode: z.string(),
  results: z.array(
    z.object({
      analyte: z.string(),
      value: z.string(),
      refMin: z.number().optional(),
      refMax: z.number().optional(),
      flag: z.string().optional(),
    }),
  ),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const order = await prisma.labOrder.create({
      data: {
        patientRefId: body.patientRefId,
        testCode: body.testCode,
        status: "RESULT_READY",
        resultJson: JSON.stringify(body.results),
        publishedAt: new Date(),
      },
    });
    return jsonOk({ orderId: order.id, imported: body.results.length }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
