import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createDepartment, listDepartments } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const cashPoint = z.enum(['HOTEL', 'FNB_POS', 'CLINIC', 'RETAIL']).nullable().optional();

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  cashPoint,
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listDepartments()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createDepartment(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
