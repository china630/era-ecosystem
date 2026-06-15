import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  authCookieName,
  hasPlatformCapability,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { CARD_CONTAINER_CLASS, PageHeader, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";

export default async function ExecutivePage() {
  const t = await getTranslations("executive");
  const tNav = await getTranslations("nav");
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName())?.value;
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifySatelliteSession(token);
  } catch {
    redirect("/login");
  }

  const canView = hasPlatformCapability(session, "canViewExecutive");

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            {tNav("home")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        {!canView ? (
          <p className="text-[13px] text-red-600">{t("accessDenied")}</p>
        ) : (
          <ExecutiveDashboard />
        )}
      </div>
    </>
  );
}
