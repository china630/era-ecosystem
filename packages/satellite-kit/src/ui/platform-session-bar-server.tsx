import { cookies } from "next/headers";
import { resolvePlatformCapabilities } from "../auth/platform-session";
import { authCookieName, verifySatelliteSession } from "../auth/session";
import { PlatformAccountBar } from "./platform-account-bar";

/** Server component: org badge + Finance deep links for SSO platform sessions. */
export async function PlatformSessionBarServer() {
  const store = await cookies();
  const token = store.get(authCookieName())?.value;
  if (!token) return null;
  try {
    const session = await verifySatelliteSession(token);
    const capabilities = resolvePlatformCapabilities(session);
    if (!capabilities.isPlatformSession) return null;
    return (
      <PlatformAccountBar
        capabilities={capabilities}
        organizationId={session.organizationId}
        className="mb-4"
      />
    );
  } catch {
    return null;
  }
}
