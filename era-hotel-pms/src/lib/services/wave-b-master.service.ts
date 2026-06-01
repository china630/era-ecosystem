import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';

export async function listPromotionCodes() {
  return prisma.promotionCode.findMany({ orderBy: { code: 'asc' } });
}

export async function createPromotionCode(input: {
  code: string;
  discountPercent: number;
  validFrom: Date;
  validTo?: Date;
  active?: boolean;
}) {
  return prisma.promotionCode.create({
    data: {
      code: input.code,
      discountPercent: toDecimal(input.discountPercent),
      validFrom: input.validFrom,
      validTo: input.validTo,
      active: input.active ?? true,
    },
  });
}

export async function listChildPricingMatrix() {
  return prisma.childPricingMatrix.findMany({ orderBy: [{ ageFrom: 'asc' }] });
}

export async function createChildPricingRow(input: {
  ageFrom: number;
  ageTo: number;
  discountPercent: number;
}) {
  return prisma.childPricingMatrix.create({
    data: {
      ageFrom: input.ageFrom,
      ageTo: input.ageTo,
      discountPercent: toDecimal(input.discountPercent),
    },
  });
}

export async function listTravelAgencies() {
  return prisma.agency.findMany({ orderBy: { code: 'asc' } });
}

export async function upsertTravelAgency(input: {
  id?: string;
  code: string;
  name: string;
  voen?: string;
  commissionPercent?: number;
  active?: boolean;
}) {
  if (input.id) {
    return prisma.agency.update({
      where: { id: input.id },
      data: {
        code: input.code,
        name: input.name,
        voen: input.voen,
        commissionPercent:
          input.commissionPercent != null ? toDecimal(input.commissionPercent) : undefined,
        active: input.active,
      },
    });
  }
  return prisma.agency.create({
    data: {
      code: input.code,
      name: input.name,
      voen: input.voen,
      commissionPercent:
        input.commissionPercent != null ? toDecimal(input.commissionPercent) : null,
      active: input.active ?? true,
    },
  });
}

export async function listClosedRooms() {
  return prisma.room.findMany({
    where: { status: { in: ['OOO', 'OOS'] } },
    include: { roomType: true, closures: { orderBy: { startDate: 'desc' }, take: 1 } },
    orderBy: { roomNumber: 'asc' },
  });
}

export async function listHousekeepers() {
  return prisma.housekeeper.findMany({
    where: { active: true },
    include: { tasks: { include: { room: true }, take: 20 } },
    orderBy: { code: 'asc' },
  });
}

export async function createHousekeeper(input: { code: string; name: string }) {
  return prisma.housekeeper.create({ data: input });
}

export async function assignTaskHousekeeper(taskId: string, housekeeperId: string | null) {
  return prisma.housekeepingTask.update({
    where: { id: taskId },
    data: { housekeeperId },
    include: { room: true, housekeeper: true },
  });
}

export async function listMinibarItems() {
  return prisma.minibarItem.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
}

export async function postMinibar(input: {
  roomId: string;
  itemId: string;
  qty: number;
  reservationId?: string;
}) {
  const item = await prisma.minibarItem.findUnique({ where: { id: input.itemId } });
  if (!item) throw new Error('Minibar item not found');
  const posting = await prisma.minibarPosting.create({
    data: {
      roomId: input.roomId,
      itemId: input.itemId,
      qty: input.qty,
      reservationId: input.reservationId,
    },
    include: { item: true, room: true },
  });

  if (input.reservationId) {
    const { postCharge } = await import('@/lib/services/folio.service');
    const fb = await prisma.revenueCode.findFirst({ where: { code: 'MINIBAR' } });
    const code = fb ?? (await prisma.revenueCode.findUnique({ where: { code: 'ROOM' } }));
    if (code) {
      await postCharge({
        reservationId: input.reservationId,
        revenueCodeId: code.id,
        amount: decimalToNumber(item.price) * input.qty,
        description: `Minibar ${item.code}`,
      });
    }
  }
  return posting;
}

export async function listLostFound() {
  return prisma.lostFoundItem.findMany({
    include: { guest: true },
    orderBy: { foundDate: 'desc' },
    take: 200,
  });
}

export async function createLostFound(input: {
  foundDate: Date;
  location: string;
  description: string;
  guestId?: string;
}) {
  return prisma.lostFoundItem.create({
    data: input,
    include: { guest: true },
  });
}

export async function listSpaPlaces() {
  return prisma.spaPlace.findMany({ orderBy: { code: 'asc' } });
}

export async function createSpaPlace(input: { code: string; name: string; capacity?: number }) {
  return prisma.spaPlace.create({
    data: { code: input.code, name: input.name, capacity: input.capacity ?? 1 },
  });
}

export async function listChannels() {
  return prisma.channel.findMany({
    include: { roomMappings: { include: { roomType: true } }, rateMappings: { include: { ratePlan: true } } },
    orderBy: { code: 'asc' },
  });
}

export async function createChannel(input: { code: string; name: string }) {
  return prisma.channel.create({ data: input });
}

export async function listGuestDocuments(guestId: string) {
  return prisma.guestDocument.findMany({ where: { guestId }, orderBy: { createdAt: 'desc' } });
}

export async function createGuestDocument(
  guestId: string,
  input: { docType: string; docNumber: string; issuedAt?: Date; expiresAt?: Date },
) {
  return prisma.guestDocument.create({ data: { guestId, ...input } });
}

export async function listGuestContacts(guestId: string) {
  return prisma.guestContact.findMany({ where: { guestId } });
}

export async function createGuestContact(
  guestId: string,
  input: { kind: string; value: string; isPrimary?: boolean },
) {
  return prisma.guestContact.create({ data: { guestId, ...input } });
}

export async function listGuestAddresses(guestId: string) {
  return prisma.guestAddress.findMany({ where: { guestId } });
}

export async function createGuestAddress(
  guestId: string,
  input: { kind: string; line1: string; line2?: string; city?: string; country?: string },
) {
  return prisma.guestAddress.create({ data: { guestId, ...input } });
}
