import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requestOrganizationId } from '@/lib/request-organization';

/** Board codes shared with HotelLookup ACCOM_TYPE. The meal dropdown reads MealPlan. */
const BOARD_MEAL_PLANS: ReadonlyArray<readonly [string, string]> = [
  ['RO', 'Room only'],
  ['BB', 'Breakfast'],
  ['HB', 'Half board'],
  ['FB', 'Full board'],
  ['AI', 'All inclusive'],
];

async function ensureBoardMealPlans() {
  try {
    const organizationId = requestOrganizationId();
    for (const [code, name] of BOARD_MEAL_PLANS) {
      await prisma.mealPlan.upsert({
        where: { organizationId_code: { organizationId, code } },
        create: { organizationId, code, name },
        update: {},
      });
    }
  } catch {
    /* list still returns existing rows */
  }
}

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    await ensureBoardMealPlans();
    const rows = await prisma.mealPlan.findMany({ orderBy: { code: 'asc' } });
    return jsonOk(serialize(rows));
  } catch (err) {
    return handleRouteError(err);
  }
}
