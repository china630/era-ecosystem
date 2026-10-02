import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import FloorPanel from "@/components/FloorPanel";

export default async function FloorPage() {
  const t = await getTranslations("floor");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      <FbPosNav />
      <h1 className="mb-3 shrink-0 text-xl font-semibold">{t("title")}</h1>
      <FloorPanel />
    </div>
  );
}
