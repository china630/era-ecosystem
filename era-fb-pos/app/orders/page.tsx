import FbPosNav from "@/components/FbPosNav";
import OrdersPanel from "@/components/OrdersPanel";

export default function OrdersPage() {
  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Active orders</h1>
      <OrdersPanel />
    </>
  );
}
