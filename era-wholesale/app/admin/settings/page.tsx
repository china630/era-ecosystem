"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default function WholesaleAdminSettingsPage() {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const [warehouseName, setWarehouseName] = useState("Demo warehouse");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(warehouseName);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/pick-lists" className={SECONDARY_BUTTON_CLASS}>
            {t("pickLists")}
          </Link>
        }
      />
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{tc("field")}</th>
            <th className="p-3">{tc("value")}</th>
            <th className="p-3 text-right">{tc("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">{t("warehouse")}</td>
            <td className="p-3">{warehouseName}</td>
            <td className="p-3 text-right">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => { setDraft(warehouseName); setOpen(true); }}>
                {tc("edit")}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ModalShell open={open} title={t("editWarehouse")} onClose={() => setOpen(false)}>
        <Field
          label={t("warehouse")}
          preset="shortText"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => { setWarehouseName(draft.trim() || warehouseName); setOpen(false); }} submitLabel={tc("save")} />
      </ModalShell>
    </div>
  );
}
