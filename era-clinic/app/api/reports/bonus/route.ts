import { z } from "zod";
import {
  getSatelliteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import { todayBakuYmd } from "@/lib/baku-day";
import { normalizeSchedule } from "@/domain/reports/bonus-schedule";
import { computeBonusMonth, loadBonusSchedule, saveBonusSchedule } from "@/domain/reports/bonus-compute";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    const url = new URL(req.url);
    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return jsonError("from and to must be YYYY-MM-DD", 400);
    const schedule = await loadBonusSchedule();
    const [month, people] = await Promise.all([
      computeBonusMonth(from, to),
      prisma.practitioner.findMany({
        where: {
          OR: [
            { active: true, cpEmploymentId: { not: null } },
            { id: { in: schedule.memberIds } },
            ...(schedule.labPractitionerId ? [{ id: schedule.labPractitionerId }] : []),
            ...(schedule.usPractitionerId ? [{ id: schedule.usPractitionerId }] : []),
          ],
        },
        select: { id: true, fullName: true, staffKind: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
    return jsonOk({ schedule, month, people });
  } catch (err) {
    return handleRouteError(err);
  }
}

const share = z.object({ refer: z.number(), perform: z.number() });
const table = z.object({
  consult: share,
  physio: share,
  massage: share,
  lab: share,
  func: share,
  lfk: share,
  cosmo: share,
});

const bodySchema = z.object({
  vatPercent: z.number(),
  profitTaxPercent: z.number(),
  fundPercent: z.number(),
  labPractitionerId: z.string().nullable(),
  usPractitionerId: z.string().nullable(),
  coefficients: z.record(z.string(), z.number()),
  memberIds: z.array(z.string()).optional(),
  walkIn: table,
  inHouse: table,
});

export async function PUT(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    const schedule = normalizeSchedule(bodySchema.parse(await req.json()));
    await saveBonusSchedule(schedule);
    return jsonOk({ schedule });
  } catch (err) {
    return handleRouteError(err);
  }
}
