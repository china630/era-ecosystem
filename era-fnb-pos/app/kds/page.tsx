import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import KdsPanel from "@/components/KdsPanel";

export default async function KdsPage() {
  const t = await getTranslations("kds");

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      <KdsPanel />
    </>
  );
}
