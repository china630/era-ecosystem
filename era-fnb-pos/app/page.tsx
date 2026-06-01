import Link from "next/link";
import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import { CARD_CLASS, PRIMARY_BTN_CLASS } from "@/lib/design-system";

export default async function DashboardPage() {
  const t = await getTranslations("home");

  return (
    <>
      <FbPosNav />
      <div className={`${CARD_CLASS} p-6`}>
        <h1 className="mb-2 text-2xl font-semibold">{t("title")}</h1>
        <p className="mb-6 text-sm text-[#7F8C8D]">
          {t.rich("subtitle", {
            hotelPms: (chunks) => (
              <strong className="text-[#34495E]">{chunks}</strong>
            ),
          })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/floor" className={PRIMARY_BTN_CLASS}>
            {t("openFloor")}
          </Link>
          <Link href="/orders" className={PRIMARY_BTN_CLASS}>
            {t("activeOrders")}
          </Link>
          <Link href="/kds" className={PRIMARY_BTN_CLASS}>
            {t("kitchenDisplay")}
          </Link>
        </div>
      </div>
    </>
  );
}
