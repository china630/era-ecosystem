import { jsonOk, handleRouteError } from "@/lib/api-utils";
import {
  assertClinicAdminRead,
  assertClinicAdminWrite,
} from "@/lib/auth/clinic-admin-guard";
import { createBed } from "@/domain/inpatient/ward.service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().min(1),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertClinicAdminRead();
  if (guard.error) return guard.error;
  try {
    const { id } = await params;
    const beds = await prisma.bed.findMany({
      where: { wardId: id },
      orderBy: { code: "asc" },
    });
    return jsonOk({ data: beds });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await assertClinicAdminWrite();
  if (guard.error) return guard.error;
  try {
    const { id: wardId } = await params;
    const body = createSchema.parse(await request.json());
    const bed = await createBed({ wardId, code: body.code, status: body.status });
    return jsonOk({ data: bed }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
