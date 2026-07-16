import { redirect } from "next/navigation";

/**
 * Root is handled by middleware (guest -> /login, authed -> /home).
 * This is only a safety fallback if middleware is bypassed.
 */
export default function FinanceRootPage() {
  redirect("/home");
}
