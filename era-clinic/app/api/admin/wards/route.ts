import { jsonOk, handleRouteError } from "@/lib/api-utils";
import {
  assertClinicAdminRead,
  assertClinicAdminWrite,
} from "@/lib/auth/clinic-admin-guard";
import { listWards, createWard } from "@/domain/inpatient/ward.service";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  dailyChargeCode: z.string().optional(),
});

export async function GET() {
  const guard = await assertClinicAdminRead();
  if (guard.error) return guard.error;
  try {
    const wards = await listWards();
    return jsonOk({ data: wards });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  const guard = await assertClinicAdminWrite();
  if (guard.error) return guard.error;
  try {
    const body = createSchema.parse(await request.json());
    const ward = await createWard(body);
    return jsonOk({ data: ward }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
