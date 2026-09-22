import { prisma } from "@/lib/prisma";
import { SATELLITE_CLINIC_WARD_DAY_CHARGE } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { bakuCivilUtcDate, bakuDateKey, bakuDayBounds } from "@/lib/baku-day";

export async function postDailyWardCharges(chargeDate: Date = new Date()) {
  const dayIso = bakuDateKey(chargeDate);
  const { start: day } = bakuDayBounds(dayIso);
  const chargeDay = bakuCivilUtcDate(dayIso);

  const admissions = await prisma.inpatientAdmission.findMany({
    where: {
      status: "ADMITTED",
      admittedAt: { lte: day },
      OR: [{ dischargedAt: null }, { dischargedAt: { gt: day } }],
    },
    include: {
      patient: true,
      dailyCharges: { where: { chargeDate: chargeDay }, take: 1 },
      assignments: {
        where: { dischargedAt: null },
        take: 1,
        include: {
          bed: { include: { ward: true } },
        },
      },
    },
  });

  let posted = 0;
  for (const admission of admissions) {
    if (admission.dailyCharges.length > 0) continue;

    const assignment = admission.assignments[0];
    if (!assignment?.bed?.ward) continue;

    const serviceCode =
      assignment.bed.ward.dailyChargeCode?.trim() || `WARD-DAY-${assignment.bed.ward.code}`;
    const amountNet = 50;

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_WARD_DAY_CHARGE,
      globalPersonId: admission.patient.globalPersonId ?? undefined,
      payload: {
        admissionId: admission.id,
        patientRef: admission.patient.refCode,
        wardCode: assignment.bed.ward.code,
        bedCode: assignment.bed.code,
        chargeDate: dayIso,
        serviceCode,
        amountNet,
        currency: "AZN",
      },
    });

    await prisma.inpatientDailyCharge.create({
      data: {
        admissionId: admission.id,
        chargeDate: chargeDay,
      },
    });

    posted++;
  }

  return { chargeDate: dayIso, scanned: admissions.length, posted };
}
