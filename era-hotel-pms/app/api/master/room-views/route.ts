import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createRoomView, listRoomViews } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listRoomViews()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createRoomView(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
