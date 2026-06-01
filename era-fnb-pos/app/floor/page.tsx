import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import FloorPanel from "@/components/FloorPanel";

export default async function FloorPage() {
  const t = await getTranslations("floor");

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      <FloorPanel />
    </>
  );
}
