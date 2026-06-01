import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import MenuAdminPanel from "@/components/MenuAdminPanel";

export default async function MenuAdminPage() {
  const t = await getTranslations("admin.menu");

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      <MenuAdminPanel />
    </>
  );
}
