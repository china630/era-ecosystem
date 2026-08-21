import { getTranslations } from "next-intl/server";
import { PageHeader } from "@era/satellite-kit/ui";
import FbPosNav from "@/components/FbPosNav";
import DailyMenuAdminPanel from "@/components/DailyMenuAdminPanel";

export default async function DailyMenuAdminPage() {
  const t = await getTranslations("admin.dailyMenu");

  return (
    <>
      <FbPosNav />
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DailyMenuAdminPanel />
    </>
  );
}
