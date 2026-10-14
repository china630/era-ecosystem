import { prisma } from '@/lib/prisma';
import { civilDay, civilWindow, ymdParam } from '@/lib/reports/civil-days';

export interface PoliceListRow {
  roomNumber: string;
  firstName: string;
  surname: string;
  nationality: string;
  idNo: string;
  sex: string;
  birthDate: string;
  birthPlace: string;
}

export interface PoliceListResult {
  businessDate: string;
  rows: PoliceListRow[];
}

type Doc = { docNumber: string | null; isPrimary: boolean };

type PersonGuest = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  nationality: string | null;
  sex: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  documents: Doc[];
};

function documentNo(docs: Doc[]): string {
  const primary = docs.find((d) => d.isPrimary && d.docNumber);
  return (primary ?? docs.find((d) => d.docNumber))?.docNumber?.trim() ?? '';
}

function splitFullName(fullName: string | null | undefined): { firstName: string; surname: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', surname: '' };
  if (parts.length === 1) return { firstName: parts[0]!, surname: '' };
  return { firstName: parts[0]!, surname: parts.slice(1).join(' ') };
}

/** Hotel stores M/F. Imported rows may still say MALE/FEMALE or Elektra 0/1. */
function sexCode(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toUpperCase();
  if (raw === 'M' || raw === 'MALE' || raw === '0') return 'M';
  if (raw === 'F' || raw === 'FEMALE' || raw === '1') return 'F';
  return raw;
}

function dayText(value: Date | null | undefined): string {
  if (!value) return '';
  return civilDay(value);
}

/** One in-house person, matching the Elektra police list columns. */
export function toPoliceListRow(input: {
  roomNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  sex: string | null;
  birthDate: Date | null;
  idCardNo: string | null;
  passportNo: string | null;
  guest: PersonGuest | null;
}): PoliceListRow {
  const guest = input.guest;
  const fromName = splitFullName(guest?.fullName);
  const firstName = input.firstName?.trim() || guest?.firstName?.trim() || fromName.firstName;
  const surname = input.lastName?.trim() || guest?.lastName?.trim() || fromName.surname;
  return {
    roomNumber: input.roomNumber?.trim() ?? '',
    firstName,
    surname,
    nationality: input.nationality?.trim() || guest?.nationality?.trim() || '',
    idNo: input.passportNo?.trim() || input.idCardNo?.trim() || documentNo(guest?.documents ?? []),
    sex: sexCode(input.sex?.trim() || guest?.sex?.trim()),
    birthDate: dayText(input.birthDate ?? guest?.birthDate),
    birthPlace: guest?.birthPlace?.trim() ?? '',
  };
}

const guestSelect = {
  firstName: true,
  lastName: true,
  fullName: true,
  nationality: true,
  sex: true,
  birthDate: true,
  birthPlace: true,
  documents: { select: { docNumber: true, isPrimary: true } },
} as const;

/**
 * People in house on the night of `businessDate` (Asia/Baku).
 * One row per person on the stay, not one row per reservation.
 */
export async function queryPoliceList(businessDate: Date | string): Promise<PoliceListResult> {
  const anchor = ymdParam(businessDate);
  const day = civilWindow(anchor, anchor);
  const stays = await prisma.reservation.findMany({
    where: {
      status: { in: ['IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: day.lt },
      checkOutDate: { gte: day.lt },
    },
    select: {
      room: { select: { roomNumber: true } },
      guest: { select: guestSelect },
      paxGuests: {
        orderBy: { sortOrder: 'asc' },
        select: {
          firstName: true,
          lastName: true,
          nationality: true,
          sex: true,
          birthDate: true,
          idCardNo: true,
          passportNo: true,
          isPrimary: true,
          departedAt: true,
          guest: { select: guestSelect },
        },
      },
    },
  });

  const rows: PoliceListRow[] = [];
  for (const stay of stays) {
    const people = stay.paxGuests.filter((pax) => {
      if (!pax.departedAt) return true;
      return civilDay(pax.departedAt) > anchor;
    });
    if (stay.paxGuests.length === 0) {
      rows.push(
        toPoliceListRow({
          roomNumber: stay.room?.roomNumber ?? null,
          firstName: stay.guest.firstName,
          lastName: stay.guest.lastName,
          nationality: stay.guest.nationality,
          sex: stay.guest.sex,
          birthDate: stay.guest.birthDate,
          idCardNo: null,
          passportNo: null,
          guest: stay.guest,
        }),
      );
      continue;
    }
    for (const pax of people) {
      const linked = pax.guest ?? (pax.isPrimary ? stay.guest : null);
      rows.push(
        toPoliceListRow({
          roomNumber: stay.room?.roomNumber ?? null,
          firstName: pax.firstName,
          lastName: pax.lastName,
          nationality: pax.nationality,
          sex: pax.sex,
          birthDate: pax.birthDate,
          idCardNo: pax.idCardNo,
          passportNo: pax.passportNo,
          guest: linked,
        }),
      );
    }
  }

  rows.sort((a, b) => {
    const room = a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    if (room !== 0) return room;
    const surname = a.surname.localeCompare(b.surname);
    if (surname !== 0) return surname;
    return a.firstName.localeCompare(b.firstName);
  });

  return { businessDate: anchor, rows };
}
