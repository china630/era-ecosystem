import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuCivilUtcDate } from "@era/satellite-kit/time";
import type { BuffetMealCode } from "@/lib/buffet-planner-math";
import { listManagementMeals } from "@/lib/buffet-management-meals.service";
import { getStaffCoversForDate } from "@/lib/buffet-staff-meal.service";
import { getGuestNightsForDate } from "@/lib/buffet-guest-nights.service";

/**
 * Forecast cover inputs for one outlet × date × meal.
 * Hotel guest-nights: manual/ESTIMATE/HOTEL rows (Wave 6); live hotel API later.
 */
export async function getBuffetCoversRollup(args: {
  outletId: string;
  serviceDateYmd: string;
  meal: BuffetMealCode;
}) {
  const organizationId = requestOrganizationId();
  const outlet = await prisma.outlet.findFirst({
    where: { id: args.outletId, organizationId },
    select: { id: true, code: true, name: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }

  const plan = await prisma.buffetPlan.findFirst({
    where: {
      organizationId,
      outletId: args.outletId,
      serviceDate: bakuCivilUtcDate(args.serviceDateYmd),
      meal: args.meal,
    },
    select: {
      id: true,
      coversAdult: true,
      coversChild: true,
      coversSource: true,
      status: true,
    },
  });

  const management = await listManagementMeals({
    outletId: args.outletId,
    fromYmd: args.serviceDateYmd,
    toYmd: args.serviceDateYmd,
    meal: args.meal,
  });

  const staff = await getStaffCoversForDate({
    outletId: args.outletId,
    serviceDateYmd: args.serviceDateYmd,
    meal: args.meal,
  });

  const planAdult = plan?.coversAdult ?? 0;
  const planChild = plan?.coversChild ?? 0;
  const planTotal = planAdult + planChild;
  const managementCount = management.length;
  const staffCovers = staff.coversStaff;
  const guestNight = await getGuestNightsForDate({
    serviceDateYmd: args.serviceDateYmd,
    organizationId,
  });
  const hotel = guestNight
    ? {
        guestNights: guestNight.guestNights,
        source: guestNight.source,
        entryId: guestNight.id,
      }
    : null;

  return {
    outletId: outlet.id,
    outletCode: outlet.code,
    outletName: outlet.name,
    serviceDate: args.serviceDateYmd,
    meal: args.meal,
    plan: plan
      ? {
          id: plan.id,
          coversAdult: planAdult,
          coversChild: planChild,
          coversTotal: planTotal,
          coversSource: plan.coversSource,
          status: plan.status,
        }
      : null,
    management: {
      count: managementCount,
      entries: management,
    },
    staff: {
      planId: staff.planId,
      coversStaff: staffCovers,
    },
    hotel,
    /**
     * Plan + management + staff covers.
     * Guest-nights are hotel occupancy (forecast pack), not meal covers — not summed here.
     */
    forecastTotal: planTotal + managementCount + staffCovers,
  };
}
