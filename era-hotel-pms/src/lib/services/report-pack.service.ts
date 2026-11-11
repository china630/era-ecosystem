import { prisma } from '@/lib/prisma';

export async function updateHotelProfilePolicyJson(profileId: string, policyJson: string) {
  return prisma.hotelProfile.update({
    where: { id: profileId },
    data: { policyJson },
  });
}
