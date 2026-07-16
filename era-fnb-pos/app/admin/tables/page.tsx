import { getTranslations } from "next-intl/server";
import Link from "next/link";
import FbPosNav from "@/components/FbPosNav";
import TablesAdminPanel from "@/components/TablesAdminPanel";
import { SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export default async function TablesAdminPage() {
  const t = await getTranslations("admin.tables");
  const tMenu = await getTranslations("admin.menu");

  return (
    <>
      <FbPosNav />
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/admin/menu" className={SECONDARY_BUTTON_CLASS}>
          {tMenu("title")}
        </Link>
      </div>
      <TablesAdminPanel />
    </>
  );
}
