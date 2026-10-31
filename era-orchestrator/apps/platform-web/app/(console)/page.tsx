import { redirect } from "next/navigation";

export default function PlatformHomePage() {
  redirect("/billing/pricing");
}
