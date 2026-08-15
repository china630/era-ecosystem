import { cookies } from "next/headers";
import {
  authCookieName,
  hasPlatformCapability,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { ClinicHomeClient } from "@/components/ClinicHomeClient";

async function canViewExecutive(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName())?.value;
  if (!token) return false;
  try {
    const session = await verifySatelliteSession(token);
    return hasPlatformCapability(session, "canViewExecutive");
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const showExecutive = await canViewExecutive();
  return <ClinicHomeClient showExecutive={showExecutive} />;
}
