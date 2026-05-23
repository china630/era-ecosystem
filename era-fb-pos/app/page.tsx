import Link from "next/link";
import FbPosNav from "@/components/FbPosNav";
import { CARD_CLASS, PRIMARY_BTN_CLASS } from "@/lib/design-system";

export default function DashboardPage() {
  return (
    <>
      <FbPosNav />
      <div className={`${CARD_CLASS} p-6`}>
        <h1 className="mb-2 text-2xl font-semibold">F&B POS</h1>
        <p className="mb-6 text-sm text-[#7F8C8D]">
          Floor map, tickets, kitchen display, and fiscal settlement. Guest folio
          and night audit stay in{" "}
          <strong className="text-[#34495E]">era-hotel-pms</strong> (bridge API).
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/floor" className={PRIMARY_BTN_CLASS}>
            Open floor
          </Link>
          <Link href="/orders" className={PRIMARY_BTN_CLASS}>
            Active orders
          </Link>
          <Link href="/kds" className={PRIMARY_BTN_CLASS}>
            Kitchen display
          </Link>
        </div>
      </div>
    </>
  );
}
