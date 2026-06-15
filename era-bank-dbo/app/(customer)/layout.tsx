import DboShell from "@/components/DboShell";
import { cookies } from "next/headers";
import { DBO_SESSION_COOKIE, verifyDboSessionCookie } from "@/lib/dbo-session-cookie";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(DBO_SESSION_COOKIE)?.value;
  const payload = token ? verifyDboSessionCookie(token) : null;
  const channel = payload?.channel ?? "RETAIL";

  return <DboShell channel={channel}>{children}</DboShell>;
}
