import { cookies } from "next/headers";

export const OUTLET_COOKIE = "era_fb_outlet_id";

export async function getSelectedOutletId(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(OUTLET_COOKIE)?.value?.trim() || undefined;
}
