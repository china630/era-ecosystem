import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  createPhysioListItem,
  listPhysioListItems,
} from "@/domain/physio/physio-catalog.service";
import { isPhysioListKind } from "@/domain/physio/physio-catalog";

const createSchema = z.object({
  listKind: z.enum(["DEVICE_PROGRAM", "SUBSTANCE"]),
  code: z.string().min(1),
  titleAz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const kindRaw = url.searchParams.get("kind") ?? "";
    if (!isPhysioListKind(kindRaw)) {
      return jsonError("kind=DEVICE_PROGRAM|SUBSTANCE is required", 400);
    }
    const rows = await listPhysioListItems(kindRaw, {
      q: url.searchParams.get("q") ?? undefined,
      activeOnly: url.searchParams.get("activeOnly") === "1",
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createPhysioListItem(body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioListItem",
      row.id,
      "CREATE",
      { listKind: row.listKind, code: row.code },
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
