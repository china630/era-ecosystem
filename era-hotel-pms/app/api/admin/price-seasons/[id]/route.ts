import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { serialize } from "@/lib/serialize";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertMasterDataWrite } from "@/lib/auth/master-data-guard";
import { updatePriceSeason } from "@/lib/services/price-season.service";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  startsOn: z.string().min(8),
  endsOn: z.string().min(8),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertMasterDataWrite(session);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const row = await updatePriceSeason(id, body, session?.sub);
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}
