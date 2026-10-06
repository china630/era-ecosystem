import { getLocale } from "next-intl/server";

/** UI locale from `?locale=` or the next-intl request cookie. */
export async function readUiLocale(req: Request): Promise<string> {
  const query = new URL(req.url).searchParams.get("locale")?.trim();
  if (query) return query.slice(0, 5);
  try {
    return (await getLocale()).slice(0, 5);
  } catch {
    return "az";
  }
}
