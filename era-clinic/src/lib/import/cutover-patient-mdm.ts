import { isValidAzFin, linkPersonIdentity } from "@era/satellite-kit";
import {
  lookupHotelGuestByIdentity,
  lookupHotelStayGlobalPerson,
} from "@/lib/hotel-stay-person";

function orderedFullName(input: {
  fullName: string;
  givenName?: string;
  surname?: string;
}): string {
  const given = input.givenName?.trim() ?? "";
  const sur = input.surname?.trim() ?? "";
  if (given && sur) return `${given} ${sur}`;
  return input.fullName.trim();
}

function classifyFoDocument(raw?: string): { fin?: string; passport?: string } {
  const t = raw?.trim() || "";
  if (!t) return {};
  if (isValidAzFin(t)) return { fin: t.toUpperCase() };
  return { passport: t };
}

/**
 * Cutover #21: FO passport/FIN → MDM (same person as hotel #10), then hotel
 * name+DOB, then WO stay. existing globalPersonId keeps re-import idempotent.
 */
export async function resolveCutoverPatientMdm(input: {
  fullName: string;
  givenName?: string;
  surname?: string;
  phone?: string;
  nationality?: string;
  sex?: string;
  birthDate?: string;
  hotelResNo?: string;
  folioPerson?: string;
  passport?: string;
  existingGlobalPersonId?: string | null;
}): Promise<string | null> {
  const fullName = orderedFullName(input);
  if (!fullName) return null;
  const existing = input.existingGlobalPersonId?.trim() || "";
  const docs = classifyFoDocument(input.passport);
  let fromHotel: string | null = null;
  if (!existing) {
    fromHotel = await lookupHotelGuestByIdentity({
      fullName,
      birthDate: input.birthDate,
      phone: input.phone,
    });
    if (!fromHotel && input.hotelResNo?.trim()) {
      fromHotel = await lookupHotelStayGlobalPerson({
        hotelResNo: input.hotelResNo,
        folioPerson: input.folioPerson,
      });
    }
  }
  const seed = existing || fromHotel || undefined;
  try {
    const linked = await linkPersonIdentity({
      fullName,
      phone: input.phone?.trim() || undefined,
      nationality: input.nationality?.trim() || undefined,
      sex: input.sex,
      birthDate: input.birthDate?.trim().slice(0, 10) || undefined,
      fin: docs.fin,
      passport: docs.passport,
      globalPersonId: seed,
    });
    return linked.globalPersonId ?? seed ?? null;
  } catch {
    return seed ?? null;
  }
}
