import Link from "next/link";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { financeWebUrl } from "@era/satellite-kit";

export default function CustomsStatusPage() {
  const finance = financeWebUrl();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Customs status"
        subtitle="SP7 L3 — declarations live in Finance Trade Pro; logistics reads status here"
        actions={
          <Link href="/trips" className={SECONDARY_BUTTON_CLASS}>
            ← Trips
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-3 p-4 text-sm text-[#34495E]`}>
        <p>
          Full GTK / e-customs capture and tariff reference data are owned by{" "}
          <strong>Finance Core</strong> (`industry_logistics_customs`). This satellite
          shows trip-level customs readiness only.
        </p>
        {finance ? (
          <Link
            href={`${finance.replace(/\/$/, "")}/customs`}
            className={SECONDARY_BUTTON_CLASS}
          >
            Open Finance customs module →
          </Link>
        ) : (
          <p className="text-[#7F8C8D]">Set NEXT_PUBLIC_FINANCE_WEB_URL for deep link.</p>
        )}
        <p className="text-xs text-[#7F8C8D]">
          Local UAT: complete a trip with POD, then verify Finance worker ingested trip
          events before filing customs in Finance UI.
        </p>
      </div>
    </div>
  );
}
