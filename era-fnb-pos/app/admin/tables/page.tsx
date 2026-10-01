import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import TablesAdminPanel from "@/components/TablesAdminPanel";

export default async function TablesAdminPage() {
  const t = await getTranslations("admin.tables");

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      <TablesAdminPanel />
    </>
  );
}
