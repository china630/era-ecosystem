import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { createImportedLabOrder } from "@/domain/lab/lab-order-write.service";

const MAX_EXTERNAL_AGE_DAYS = 90;

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
  source: z.enum(["IN_HOUSE", "EXTERNAL"]).default("EXTERNAL"),
  resultDate: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const resultDate = new Date(body.resultDate);
    if (Number.isNaN(resultDate.getTime())) {
      return jsonError("Invalid resultDate", 400);
    }
    const ageMs = Date.now() - resultDate.getTime();
    if (ageMs > MAX_EXTERNAL_AGE_DAYS * 24 * 60 * 60 * 1000) {
      return jsonError(
        `External lab results older than ${MAX_EXTERNAL_AGE_DAYS} days are not accepted`,
        400,
      );
    }
    if (ageMs < -24 * 60 * 60 * 1000) {
      return jsonError("resultDate cannot be in the future", 400);
    }

    const order = await createImportedLabOrder({
      patientRefId: body.patientRefId,
      code: body.testCode,
      results: body.results,
      source: body.source,
      resultDate,
    });
    return jsonOk({ orderId: order.id, imported: body.results.length }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
