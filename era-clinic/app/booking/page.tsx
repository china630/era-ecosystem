"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

export default function BookingWidgetPage() {
  const t = useTranslations("booking");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState("");

  async function book() {
    const ref = phone || `WEB-${Date.now()}`;
    const res = await fetch("/api/booking/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerRef: ref,
        customerName: name,
        customerPhone: phone,
        scheduledAt: new Date(when).toISOString(),
      }),
    });
    if (res.ok) {
      showSuccess(t("success"));
      return;
    }
    showApiError(await res.json().catch(() => ({})), t("error"));
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} max-w-md space-y-3 p-4`}>
        <input
          className="w-full rounded border px-2 py-1"
          placeholder={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded border px-2 py-1"
          placeholder={t("phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          type="datetime-local"
          className="w-full rounded border px-2 py-1"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void book()}>
          {t("submit")}
        </button>
      </div>
    </>
  );
}
