"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default function CashierPage() {
  const t = useTranslations("cashier");
  const params = useSearchParams();
  const visitId = params.get("visitId") ?? "";
  const [shiftId, setShiftId] = useState("");
  const [result, setResult] = useState<string>("");

  async function openShift() {
    const res = await fetch("/api/cashier/shifts/open", { method: "POST" });
    const d = await res.json();
    setShiftId(d.data?.id ?? d.id ?? "");
  }

  async function pay() {
    if (!visitId || !shiftId) return;
    const res = await fetch(`/api/cashier/receipts/${visitId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, paymentMethod: "CASH" }),
    });
    setResult(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <p className="text-sm">Visit: {visitId || "—"}</p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openShift()}>
          {t("openShift")}
        </button>
        <p className="text-xs">Shift: {shiftId || "—"}</p>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void pay()}>
          {t("pay")}
        </button>
        {result && <pre className="text-xs">{result}</pre>}
      </div>
    </>
  );
}
