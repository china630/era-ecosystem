import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default async function OrdersPage() {
  const t = await getTranslations("orders");
  const tNav = await getTranslations("nav");
  const tImp = await getTranslations("importOrders");

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/import-orders" className={SECONDARY_BUTTON_CLASS}>
              {tImp("title")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        <p className="text-[13px] text-[#7F8C8D]">{t("shellNote")}</p>
        <Link href="/admin/import-orders" className={`${PRIMARY_BUTTON_CLASS} mt-4 inline-block`}>
          {tImp("openAdmin")}
        </Link>
      </div>
    </>
  );
}
