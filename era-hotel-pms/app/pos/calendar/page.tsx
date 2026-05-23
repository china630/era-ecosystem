import { redirect } from "next/navigation";

/** POS calendar UI moved to era-fb-pos satellite. */
export default function PosCalendarRedirectPage() {
  const url =
    process.env.NEXT_PUBLIC_FB_POS_URL ?? "http://localhost:3200/calendar";
  redirect(url);
}
