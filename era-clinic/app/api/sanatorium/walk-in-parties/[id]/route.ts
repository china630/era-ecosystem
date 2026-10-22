import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import {
  WalkInPartyError,
  addWalkInPartyGuest,
  addWalkInPartyLine,
  getWalkInParty,
  listWalkInPartyJournal,
  removeWalkInPartyGuest,
  removeWalkInPartyLine,
  sendWalkInPartyToCashier,
  updateWalkInPartyGuest,
} from "@/domain/sanatorium/walk-in-party.service";

const sex = z.enum(["MALE", "FEMALE"]);

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("addGuest"),
    sex,
    nationality: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    patientRefId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("updateGuest"),
    guestId: z.string().min(1),
    sex,
    nationality: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
  z.object({
    action: z.literal("removeGuest"),
    guestId: z.string().min(1),
  }),
  z.object({
    action: z.literal("addLine"),
    guestId: z.string().min(1),
    kind: z.enum(["procedure", "lab", "visit"]),
    code: z.string().min(1),
    qty: z.number().int().min(1).max(20).optional(),
    practitionerId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("removeLine"),
    guestId: z.string().min(1),
    lineId: z.string().min(1),
    kind: z.enum(["procedure", "lab", "visit"]),
  }),
  z.object({ action: z.literal("send") }),
]);

function fail(err: unknown) {
  if (err instanceof WalkInPartyError) return jsonError(err.message, err.status, { code: err.code });
  return handleRouteError(err);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertOpsApiPermission(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const journal = new URL(req.url).searchParams.get("journal") === "1";
    return jsonOk(journal ? await listWalkInPartyJournal(id) : await getWalkInParty(id));
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await assertOpsApiPermission(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const actor = { userId: guard.session.sub, actorName: guard.session.fullName, request: req };
    if (body.action === "addGuest") return jsonOk(await addWalkInPartyGuest(id, body, actor));
    if (body.action === "updateGuest") {
      return jsonOk(await updateWalkInPartyGuest(id, body.guestId, body, actor));
    }
    if (body.action === "removeGuest") {
      return jsonOk(await removeWalkInPartyGuest(id, body.guestId, actor));
    }
    if (body.action === "addLine") return jsonOk(await addWalkInPartyLine(id, body.guestId, body, actor));
    if (body.action === "removeLine") {
      return jsonOk(await removeWalkInPartyLine(id, body.guestId, body.lineId, body.kind, actor));
    }
    return jsonOk(await sendWalkInPartyToCashier(id, actor));
  } catch (err) {
    return fail(err);
  }
}
