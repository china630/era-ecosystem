import { cookies } from "next/headers";
import { ERA_I18N_COOKIE, isLocale } from "@era/i18n-common";

export async function resolvePublicAzRuLocale(): Promise<"az" | "ru"> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ERA_I18N_COOKIE)?.value;
  if (fromCookie && isLocale(fromCookie) && fromCookie !== "en") return fromCookie;
  return "az";
}
