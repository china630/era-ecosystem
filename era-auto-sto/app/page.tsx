import Link from "next/link";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default function HomePage() {
  return (
    <>
      <PageHeader title="ERA Auto STO" subtitle="ERA industry satellite" />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <p className="text-[13px] text-[#7F8C8D]">MVP operational shell aligned with DESIGN.md.</p>
        <ul className="space-y-2 text-[13px]">
          <li>
            <Link href="/api/health" className="font-medium text-[#2980B9] hover:underline">
              Health API
            </Link>
          </li>
          <li>
            <Link href="/work-orders" className={PRIMARY_BUTTON_CLASS}>
              Open main screen
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
