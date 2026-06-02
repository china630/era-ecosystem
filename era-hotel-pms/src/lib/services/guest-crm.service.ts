import { prisma } from '@/lib/prisma';

export async function getGuestCrmBadges(guestId: string) {
  const [specialNotes, allergens] = await Promise.all([
    prisma.guestNote.count({ where: { guestId, noteType: 'SPECIAL' } }),
    prisma.guestAllergen.count({ where: { guestId } }),
  ]);
  return { specialNotes, allergens };
}

// Tags
export async function listGuestTags(guestId: string) {
  return prisma.guestTag.findMany({ where: { guestId }, orderBy: { name: 'asc' } });
}

export async function createGuestTag(guestId: string, name: string) {
  return prisma.guestTag.create({ data: { guestId, name: name.trim() } });
}

export async function deleteGuestTag(id: string, guestId: string) {
  return prisma.guestTag.deleteMany({ where: { id, guestId } });
}

// Archive files
export async function listGuestArchiveFiles(guestId: string) {
  return prisma.guestArchiveFile.findMany({
    where: { guestId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGuestArchiveFile(
  guestId: string,
  input: { title: string; docType: string; mimeType?: string; sizeBytes?: number; storageKey?: string },
) {
  return prisma.guestArchiveFile.create({
    data: {
      guestId,
      title: input.title,
      docType: input.docType,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      storageKey: input.storageKey ?? `stub/${Date.now()}`,
    },
  });
}

// Preferences
export async function listGuestPreferences(guestId: string) {
  return prisma.guestPreference.findMany({ where: { guestId }, orderBy: { createdAt: 'desc' } });
}

export async function createGuestPreference(
  guestId: string,
  input: { preference: string; note?: string; importance?: string; department?: string },
) {
  return prisma.guestPreference.create({ data: { guestId, ...input } });
}

export async function deleteGuestPreference(id: string, guestId: string) {
  return prisma.guestPreference.deleteMany({ where: { id, guestId } });
}

// Allergens
export async function listGuestAllergens(guestId: string) {
  return prisma.guestAllergen.findMany({ where: { guestId }, orderBy: { createdAt: 'desc' } });
}

export async function createGuestAllergen(guestId: string, input: { allergen: string; note?: string }) {
  return prisma.guestAllergen.create({ data: { guestId, ...input } });
}

export async function deleteGuestAllergen(id: string, guestId: string) {
  return prisma.guestAllergen.deleteMany({ where: { id, guestId } });
}

// Special dates
export async function listGuestSpecialDates(guestId: string) {
  return prisma.guestSpecialDate.findMany({ where: { guestId }, orderBy: { eventDate: 'asc' } });
}

export async function createGuestSpecialDate(
  guestId: string,
  input: { dateType: string; eventDate: Date; note?: string },
) {
  return prisma.guestSpecialDate.create({ data: { guestId, ...input } });
}

// Favorite rooms
export async function listGuestFavoriteRooms(guestId: string) {
  return prisma.guestFavoriteRoom.findMany({ where: { guestId }, orderBy: { createdAt: 'desc' } });
}

export async function createGuestFavoriteRoom(
  guestId: string,
  input: { roomNumber: string; roomType?: string; note?: string },
) {
  return prisma.guestFavoriteRoom.create({ data: { guestId, ...input } });
}

export async function listSpecialGuestNotes(guestId: string) {
  return prisma.guestNote.findMany({
    where: { guestId, noteType: 'SPECIAL' },
    orderBy: { updatedAt: 'desc' },
  });
}

// Comments / reclaims
export async function listGuestComments(guestId: string, reclaimOnly = false) {
  return prisma.guestComment.findMany({
    where: {
      guestId,
      ...(reclaimOnly ? { actionType: 'RECLAIM' } : {}),
    },
    orderBy: { commentDate: 'desc' },
  });
}

export async function createGuestComment(
  guestId: string,
  input: {
    comment: string;
    state?: string;
    answer?: string;
    source?: string;
    actionType?: string;
  },
) {
  return prisma.guestComment.create({
    data: {
      guestId,
      comment: input.comment,
      state: input.state ?? 'NEW',
      answer: input.answer ?? null,
      source: input.source ?? null,
      actionType: input.actionType ?? null,
      commentDate: new Date(),
    },
  });
}

// Surveys
export async function listGuestSurveys(guestId: string) {
  return prisma.guestSurvey.findMany({ where: { guestId }, orderBy: { filledAt: 'desc' } });
}

export async function createGuestSurvey(
  guestId: string,
  input: { surveyName: string; filledAt: Date; note?: string },
) {
  return prisma.guestSurvey.create({ data: { guestId, ...input } });
}

// Incidents
export async function listGuestIncidents(guestId: string) {
  return prisma.guestIncident.findMany({ where: { guestId }, orderBy: { incidentDate: 'desc' } });
}

export async function createGuestIncident(
  guestId: string,
  input: { location: string; description: string; action?: string; incidentDate?: Date },
) {
  return prisma.guestIncident.create({
    data: {
      guestId,
      location: input.location,
      description: input.description,
      action: input.action ?? null,
      incidentDate: input.incidentDate ?? new Date(),
    },
  });
}

// Communications
export async function listGuestCommunications(guestId: string, channel?: string) {
  return prisma.guestCommunication.findMany({
    where: { guestId, ...(channel ? { channel } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGuestCommunication(
  guestId: string,
  input: { channel: string; subject?: string; body: string; recipient?: string },
) {
  return prisma.guestCommunication.create({
    data: {
      guestId,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      recipient: input.recipient ?? null,
      status: 'STUB',
    },
  });
}

export async function listGuestContactLogs(guestId: string) {
  return prisma.guestContactLog.findMany({
    where: { guestId },
    orderBy: { contactDate: 'desc' },
  });
}

// Family
export async function listGuestFamily(guestId: string) {
  return prisma.guestFamily.findMany({
    where: { guestId },
    include: { relatedGuest: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGuestFamily(
  guestId: string,
  input: { relatedGuestId: string; relationship: string },
) {
  return prisma.guestFamily.create({
    data: { guestId, relatedGuestId: input.relatedGuestId, relationship: input.relationship },
    include: { relatedGuest: { select: { id: true, fullName: true } } },
  });
}

export async function deleteGuestFamily(id: string, guestId: string) {
  return prisma.guestFamily.deleteMany({ where: { id, guestId } });
}

export async function listAccompanyingGuests(guestId: string) {
  const reservations = await prisma.reservation.findMany({
    where: { guestId },
    select: { id: true, shareNo: true, checkInDate: true, checkOutDate: true, room: { select: { roomNumber: true } } },
  });
  const resIds = reservations.map((r) => r.id);
  if (resIds.length === 0) return [];

  const pax = await prisma.reservationGuest.findMany({
    where: { reservationId: { in: resIds }, isPrimary: false },
    include: {
      reservation: {
        select: {
          id: true,
          shareNo: true,
          checkInDate: true,
          checkOutDate: true,
          room: { select: { roomNumber: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return pax.map((p) => ({
    id: p.id,
    reservationId: p.reservationId,
    roomNumber: p.reservation.room?.roomNumber ?? null,
    firstName: p.firstName,
    lastName: p.lastName,
    nationality: p.nationality,
    age: p.age,
    arrival: p.reservation.checkInDate,
    departure: p.reservation.checkOutDate,
    shareNo: p.reservation.shareNo,
  }));
}

export async function listBookerHistory(guestId: string) {
  const guest = await prisma.guest.findUnique({ where: { id: guestId }, select: { fullName: true } });
  if (!guest) return [];
  return prisma.reservation.findMany({
    where: {
      OR: [{ bookerGuestId: guestId }, { booker: guest.fullName }],
      guestId: { not: guestId },
    },
    include: { guest: { select: { fullName: true } }, room: { select: { roomNumber: true } } },
    orderBy: { checkInDate: 'desc' },
    take: 200,
  });
}

export async function getGuestReservationAnalytics(guestId: string) {
  const rows = await prisma.reservation.findMany({
    where: { guestId },
    select: {
      tripReason: true,
      source: { select: { code: true, name: true } },
      totalAmount: true,
    },
  });

  const tripMap = new Map<string, { count: number; total: number }>();
  const sourceMap = new Map<string, { count: number; total: number; name: string }>();

  for (const r of rows) {
    const tr = r.tripReason?.trim() || 'UNKNOWN';
    const t = tripMap.get(tr) ?? { count: 0, total: 0 };
    t.count += 1;
    t.total += Number(r.totalAmount);
    tripMap.set(tr, t);

    const sc = r.source?.code ?? 'DIRECT';
    const sn = r.source?.name ?? sc;
    const s = sourceMap.get(sc) ?? { count: 0, total: 0, name: sn };
    s.count += 1;
    s.total += Number(r.totalAmount);
    sourceMap.set(sc, s);
  }

  return {
    tripReasons: [...tripMap.entries()].map(([tripReason, v]) => ({
      tripReason,
      resCount: v.count,
      totalPrice: v.total,
    })),
    sources: [...sourceMap.entries()].map(([code, v]) => ({
      resSource: code,
      sourceName: v.name,
      roomCount: v.count,
      totalRevenue: v.total,
    })),
  };
}
