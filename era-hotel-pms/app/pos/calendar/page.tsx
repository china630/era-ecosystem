import { redirect } from "next/navigation";

/** POS calendar UI moved to era-fnb-pos satellite. */
export default function PosCalendarRedirectPage() {
  const url =
    process.env.NEXT_PUBLIC_FNB_POS_URL ??
    process.env.NEXT_PUBLIC_FB_POS_URL ??
    "http://localhost:3202/calendar";
  redirect(url);
}
