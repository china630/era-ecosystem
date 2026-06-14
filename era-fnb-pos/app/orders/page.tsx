import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import OrdersPanel from "@/components/OrdersPanel";
import PosShiftPanel from "@/components/PosShiftPanel";

export default async function OrdersPage() {
  const t = await getTranslations("orders");

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>
      <PosShiftPanel />
      <OrdersPanel />
    </>
  );
}
