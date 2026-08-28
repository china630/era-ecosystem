import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";
import { requestOrganizationId } from "@/lib/request-organization";

function hotelBaseUrl(): string {
  return (
    process.env.HOTEL_PMS_URL?.trim() ||
    process.env.ERA_HOTEL_PMS_ORIGIN?.trim() ||
    "http://127.0.0.1:3201"
  ).replace(/\/$/, "");
}

function serviceToken(): string | undefined {
  return (
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    undefined
  );
}

async function hotelOrganizationId(): Promise<string | null> {
  try {
    const fromPolicy = await getClinicHotelOrganizationId();
    if (fromPolicy?.trim()) return fromPolicy.trim();
  } catch {
    /* cutover policy / ALS missing — try clinic org */
  }
  try {
    return requestOrganizationId();
  } catch {
    return null;
  }
}

/** Fail-soft: hotel not up / stay missing → null (MDM resolve still runs). */
export async function lookupHotelStayGlobalPerson(input: {
  hotelResNo: string;
  folioPerson?: string;
}): Promise<string | null> {
  const externalRef = input.hotelResNo.trim();
  if (!externalRef) return null;
  const token = serviceToken();
  const organizationId = await hotelOrganizationId();
  if (!token || !organizationId) return null;

  const folio = Number(input.folioPerson);
  const qs = new URLSearchParams({ externalRef, organizationId });
  if (Number.isFinite(folio) && folio > 0) qs.set("folioPerson", String(folio));

  try {
    const res = await fetch(`${hotelBaseUrl()}/api/internal/v1/stays/by-external-ref?${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
        "x-era-organization-id": organizationId,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { globalPersonId?: string | null };
      globalPersonId?: string | null;
    };
    const id = data.data?.globalPersonId ?? data.globalPersonId;
    return id?.trim() || null;
  } catch {
    return null;
  }
}

/** Name + DOB (+ phone tie-break) — WO/EW copy-paste FIO. Fail-soft. */
export async function lookupHotelGuestByIdentity(input: {
  fullName: string;
  birthDate?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const fullName = input.fullName.trim();
  const birthDate = (input.birthDate ?? "").trim().slice(0, 10);
  if (!fullName || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const token = serviceToken();
  const organizationId = await hotelOrganizationId();
  if (!token || !organizationId) return null;

  const qs = new URLSearchParams({ organizationId, fullName, birthDate });
  if (input.phone?.trim()) qs.set("phone", input.phone.trim());

  try {
    const res = await fetch(`${hotelBaseUrl()}/api/internal/v1/guests/by-identity?${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
        "x-era-organization-id": organizationId,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { globalPersonId?: string | null };
      globalPersonId?: string | null;
    };
    const id = data.data?.globalPersonId ?? data.globalPersonId;
    return id?.trim() || null;
  } catch {
    return null;
  }
}
