import { linkPersonIdentity } from "@era/satellite-kit";
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

/**
 * Cutover #21: match hotel Guest (name + DOB + phone), then WO hotelResNo stay,
 * else MDM resolve/create. existing globalPersonId keeps re-import idempotent.
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
  existingGlobalPersonId?: string | null;
}): Promise<string | null> {
  const fullName = orderedFullName(input);
  if (!fullName) return null;
  const existing = input.existingGlobalPersonId?.trim() || "";
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
      globalPersonId: seed,
    });
    return linked.globalPersonId ?? seed ?? null;
  } catch {
    return seed ?? null;
  }
}
