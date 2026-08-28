import { prisma } from '@/lib/prisma';
import {
  composePersonFullName,
  foldPersonName,
  phoneMatchKey,
} from '@/lib/person-documents';

function startOfUtcDay(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Clinic #21 cutover: copy-paste names — match Guest by given+surname (+patronymic in given)
 * + birthDate, phone as tie-break.
 */
export async function lookupGuestGlobalPersonByIdentity(input: {
  organizationId: string;
  fullName: string;
  birthDate?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const folded = foldPersonName(input.fullName);
  if (!folded) return null;
  const dob = input.birthDate ? startOfUtcDay(input.birthDate.trim().slice(0, 10)) : null;
  const phoneKey = phoneMatchKey(input.phone);

  const where: {
    organizationId: string;
    birthDate?: Date;
  } = { organizationId: input.organizationId };
  if (dob) where.birthDate = dob;

  const candidates = await prisma.guest.findMany({
    where,
    select: {
      globalPersonId: true,
      fullName: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
    },
    take: 40,
  });

  const nameHits = candidates.filter((g) => {
    const composed = foldPersonName(
      composePersonFullName(g.firstName, g.middleName, g.lastName) || g.fullName,
    );
    return composed === folded || foldPersonName(g.fullName) === folded;
  });
  if (nameHits.length === 0) return null;

  const withMdm = (rows: typeof nameHits) =>
    rows.map((g) => g.globalPersonId?.trim()).filter(Boolean) as string[];

  if (nameHits.length === 1) {
    return withMdm(nameHits)[0] ?? null;
  }
  if (phoneKey) {
    const byPhone = nameHits.filter((g) => phoneMatchKey(g.phone) === phoneKey);
    if (byPhone.length === 1) return withMdm(byPhone)[0] ?? null;
    if (byPhone.length > 1) return withMdm(byPhone)[0] ?? null;
  }
  return null;
}
