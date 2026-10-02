"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";
import {
  CARD_CONTAINER_CLASS,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const tNav = useTranslations("nav");
  const [outletName, setOutletName] = useState(t("defaultOutletName"));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(outletName);
  const [dayStart, setDayStart] = useState("05:00");
  const [dayOpen, setDayOpen] = useState(false);
  const [dayDraft, setDayDraft] = useState("05:00");

  useEffect(() => {
    void fetch("/api/settings/business-day")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.businessDayStart === "string") setDayStart(d.businessDayStart);
      })
      .catch(() => undefined);
  }, []);

  async function saveDayStart() {
    const res = await fetch("/api/settings/business-day", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessDayStart: dayDraft }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("save"));
      return;
    }
    setDayStart(typeof data?.businessDayStart === "string" ? data.businessDayStart : dayDraft);
    setDayOpen(false);
    showSuccess(t("saved"));
  }

  return (
    <>
      <FbPosNav />
      <PageHeader
        title={t("title")}
        actions={
          <Link href="/admin/menu" className={SECONDARY_BUTTON_CLASS}>
            {tNav("menu")}
          </Link>
        }
      />
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{t("field")}</th>
            <th className="p-3">{t("value")}</th>
            <th className="p-3 text-right">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">{t("outletName")}</td>
            <td className="p-3">{outletName}</td>
            <td className="p-3 text-right">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => { setDraft(outletName); setOpen(true); }}>
                {t("edit")}
              </button>
            </td>
          </tr>
          <tr>
            <td className="p-3 font-medium">{t("businessDayStart")}</td>
            <td className="p-3">
              {dayStart}
            </td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setDayDraft(dayStart);
                  setDayOpen(true);
                }}
              >
                {t("edit")}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ModalShell open={open} title={t("editOutlet")} onClose={() => setOpen(false)}>
        <Field
          label={t("outletName")}
          preset="shortText"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => { setOutletName(draft.trim() || outletName); setOpen(false); }} submitLabel={t("save")} />
      </ModalShell>
      <ModalShell open={dayOpen} title={t("businessDayStart")} onClose={() => setDayOpen(false)}>
        <Field
          label={t("businessDayStart")}
          preset="shortText"
          type="time"
          value={dayDraft}
          onChange={(e) => setDayDraft(e.target.value)}
        />
        <ModalFooter onCancel={() => setDayOpen(false)} onSubmit={() => void saveDayStart()} submitLabel={t("save")} />
      </ModalShell>
    </>
  );
}
