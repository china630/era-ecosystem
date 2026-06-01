import { redirect } from "next/navigation";

const ORCH_WEB =
  process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000";

export default function RegisterRedirectPage() {
  redirect(`${ORCH_WEB.replace(/\/$/, "")}/register`);
}
