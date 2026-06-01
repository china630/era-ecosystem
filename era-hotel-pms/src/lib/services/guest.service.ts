import { prisma } from '@/lib/prisma';
import { normalizeGuestInput, type CreateGuestInput } from '@/lib/guest-input';

export async function listGuests() {
  return prisma.guest.findMany({ orderBy: { fullName: 'asc' } });
}

export async function createGuest(input: CreateGuestInput) {
  const data = normalizeGuestInput(input);
  return prisma.guest.create({ data });
}
