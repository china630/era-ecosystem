export type HotelRevenueOption = { value: string; label: string };

export type HotelRevenueLoad = {
  options: HotelRevenueOption[];
  notice: "" | "hotelRevenueEmpty" | "hotelRevenueNotLinked" | "hotelRevenueUnavailable" | "hotelRevenueForbidden";
};

/** Picker payload. `notice` is a `common` message key. */
export async function loadHotelRevenueCodes(): Promise<HotelRevenueLoad> {
  const res = await fetch("/api/admin/hotel-revenue-codes");
  const body = (await res.json().catch(() => null)) as {
    codes?: { code: string; name: string }[];
    data?: { codes?: { code: string; name: string }[] };
    code?: string;
  } | null;
  if (res.status === 403) return { options: [], notice: "hotelRevenueForbidden" };
  if (res.status === 409 || body?.code === "HOTEL_NOT_LINKED") {
    return { options: [], notice: "hotelRevenueNotLinked" };
  }
  if (!res.ok) return { options: [], notice: "hotelRevenueUnavailable" };
  const codes = body?.data?.codes ?? body?.codes ?? [];
  const options = codes.map((row) => ({
    value: row.code,
    label: row.name ? `${row.code} — ${row.name}` : row.code,
  }));
  return { options, notice: options.length === 0 ? "hotelRevenueEmpty" : "" };
}
