import { redirect } from "next/navigation";

const ORCH_WEB =
  process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3100";

export default async function IndustryRedirectPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  redirect(`${ORCH_WEB.replace(/\/$/, "")}/industry/${vertical}`);
}
