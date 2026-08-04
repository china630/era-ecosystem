import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { BODY_PART_CODES } from "@/lib/body-part-codes";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  bodyPart: z.enum(BODY_PART_CODES),
  note: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rows = await prisma.patientContraindication.findMany({
      where: { patientRefId: id },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: patientRefId } = await params;
    const url = new URL(req.url);
    const rowId = url.searchParams.get("id");
    if (!rowId) return jsonError("id required", 400);
    await prisma.patientContraindication.deleteMany({
      where: { id: rowId, patientRefId },
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const row = await prisma.patientContraindication.create({
      data: {
        patientRefId: id,
        bodyPart: body.bodyPart,
        note: body.note,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
