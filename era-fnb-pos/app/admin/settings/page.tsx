"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";
import {
  CARD_CONTAINER_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const tNav = useTranslations("nav");
  const [outletName, setOutletName] = useState(t("defaultOutletName"));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(outletName);

  return (
    <>
      <FbPosNav />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
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
        </tbody>
      </table>
      <ModalShell open={open} title={t("editOutlet")} onClose={() => setOpen(false)}>
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => { setOutletName(draft.trim() || outletName); setOpen(false); }} submitLabel={t("save")} />
      </ModalShell>
    </>
  );
}
