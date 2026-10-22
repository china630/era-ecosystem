import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { todayBakuYmd } from "@/lib/baku-day";
import { WalkInPartyError, createWalkInParty, listWalkInParties } from "@/domain/sanatorium/walk-in-party.service";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function fail(err: unknown) {
  if (err instanceof WalkInPartyError) return jsonError(err.message, err.status, { code: err.code });
  return handleRouteError(err);
}

export async function GET(req: Request) {
  try {
    const guard = await assertOpsApiPermission(req);
    if (guard.error) return guard.error;
    return jsonOk(await listWalkInParties());
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertOpsApiPermission(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const party = await createWalkInParty(
      { name: body.name, visitDate: body.visitDate ?? todayBakuYmd() },
      { userId: guard.session.sub, actorName: guard.session.fullName, request: req },
    );
    return jsonOk(party);
  } catch (err) {
    return fail(err);
  }
}
