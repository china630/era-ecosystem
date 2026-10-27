import type { TourBoardingCloseMode, TourChargeMode, TourOpsPolicy } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

const DEFAULTS = {
  chargeMode: 'CHARGE_ON_BOARDING' as TourChargeMode,
  boardingCloseMode: 'MANUAL' as TourBoardingCloseMode,
  autoCutoffMinutesBeforePickup: null as number | null,
  allowOverbook: true,
  dropUnboardedOnClose: true,
};

export async function getTourOpsPolicy(organizationId?: string): Promise<TourOpsPolicy> {
  const orgId = organizationId ?? requestOrganizationId();
  const existing = await prisma.tourOpsPolicy.findUnique({ where: { organizationId: orgId } });
  if (existing) return existing;
  return prisma.tourOpsPolicy.create({
    data: {
      organizationId: orgId,
      ...DEFAULTS,
    },
  });
}

export async function saveTourOpsPolicy(
  patch: {
    chargeMode?: TourChargeMode;
    boardingCloseMode?: TourBoardingCloseMode;
    autoCutoffMinutesBeforePickup?: number | null;
    allowOverbook?: boolean;
    dropUnboardedOnClose?: boolean;
  },
  organizationId?: string,
): Promise<TourOpsPolicy> {
  const orgId = organizationId ?? requestOrganizationId();
  if (
    patch.boardingCloseMode === 'AUTO_CUTOFF' &&
    (patch.autoCutoffMinutesBeforePickup == null || patch.autoCutoffMinutesBeforePickup < 1)
  ) {
    throw new Error('AUTO_CUTOFF requires autoCutoffMinutesBeforePickup >= 1');
  }
  const current = await getTourOpsPolicy(orgId);
  return prisma.tourOpsPolicy.update({
    where: { id: current.id },
    data: {
      chargeMode: patch.chargeMode,
      boardingCloseMode: patch.boardingCloseMode,
      autoCutoffMinutesBeforePickup:
        patch.autoCutoffMinutesBeforePickup === undefined
          ? undefined
          : patch.autoCutoffMinutesBeforePickup,
      allowOverbook: patch.allowOverbook,
      dropUnboardedOnClose: patch.dropUnboardedOnClose,
    },
  });
}
