import { getTranslations } from "next-intl/server";
import FbPosNav from "@/components/FbPosNav";
import OrdersPanel from "@/components/OrdersPanel";
import PosShiftPanel from "@/components/PosShiftPanel";

export default async function OrdersPage() {
  const t = await getTranslations("orders");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      <FbPosNav />
      <h1 className="mb-3 shrink-0 text-xl font-semibold">{t("title")}</h1>
      <PosShiftPanel />
      <OrdersPanel />
    </div>
  );
}
