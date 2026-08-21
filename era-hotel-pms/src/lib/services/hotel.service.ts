import { prisma } from '@/lib/prisma';
import { satelliteOrganizationId } from '@era/satellite-kit/orchestrator-gateway';

export async function getHotelProfile() {
  return prisma.hotelProfile.findFirst();
}

export async function upsertHotelProfile(input: {
  name: string;
  currency?: string;
  timezone?: string;
  propertyCode: string;
  roomCapacity?: number;
}) {
  const organizationId = satelliteOrganizationId();
  const existing = await prisma.hotelProfile.findFirst();
  if (existing) {
    return prisma.hotelProfile.update({
      where: { id: existing.id },
      data: {
        ...input,
        ...(existing.organizationId === 'unbound' || existing.organizationId === 'nafta-sanatorium-org'
          ? { organizationId }
          : {}),
      },
    });
  }
  return prisma.hotelProfile.create({
    data: { ...input, organizationId },
  });
}

export async function getPropertyCode(): Promise<string> {
  const profile = await getHotelProfile();
  return profile?.propertyCode ?? process.env.HOTEL_PROPERTY_CODE ?? 'ERA-HOTEL-001';
}
