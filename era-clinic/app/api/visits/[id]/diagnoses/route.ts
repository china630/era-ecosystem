import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";
import {
  addVisitDiagnosis,
  deleteVisitDiagnosis,
  listVisitDiagnoses,
} from "@/domain/icd/diagnosis-write.service";

const createSchema = z.object({
  icdCodeId: z.string().min(1),
  role: z.enum(["PRIMARY", "SECONDARY"]).optional(),
  note: z.string().max(500).optional().nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    return jsonOk({ items: await listVisitDiagnoses(id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    const row = await addVisitDiagnosis(id, {
      ...body,
      recordedByUserId: session.sub,
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await deleteVisitDiagnosis(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
