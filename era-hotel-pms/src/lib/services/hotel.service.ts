import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

export interface HotelProfileInput {
  name: string;
  currency?: string;
  timezone?: string;
  propertyCode?: string;
  roomCapacity?: number;
  bedCapacity?: number | null;
  printName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export async function getHotelProfile() {
  return prisma.hotelProfile.findFirst();
}

export async function upsertHotelProfile(input: HotelProfileInput) {
  const organizationId = requestOrganizationId();
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
  // Without a profile, reports use the active room count and the env property code; keep both on first save.
  const roomCapacity =
    input.roomCapacity ?? (await prisma.room.count({ where: { deleted: false, disabled: false } }));
  return prisma.hotelProfile.create({
    data: {
      ...input,
      propertyCode: input.propertyCode ?? process.env.HOTEL_PROPERTY_CODE ?? 'ERA-HOTEL-001',
      roomCapacity,
      organizationId,
    },
  });
}

export async function getPropertyCode(): Promise<string> {
  const profile = await getHotelProfile();
  return profile?.propertyCode ?? process.env.HOTEL_PROPERTY_CODE ?? 'ERA-HOTEL-001';
}
