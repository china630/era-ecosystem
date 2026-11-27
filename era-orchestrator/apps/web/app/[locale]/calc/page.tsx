import { redirect } from "next/navigation";

/** Calc stays on unprefixed `/calc` (owns `?q=` history). Locale path redirects. */
export default async function LocaleCalcRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  redirect(q ? `/calc?q=${encodeURIComponent(q)}` : "/calc");
}
