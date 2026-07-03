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

export default function LogisticsSettingsPage() {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const [fleetName, setFleetName] = useState("Demo fleet");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(fleetName);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/trips" className={SECONDARY_BUTTON_CLASS}>
            {t("trips")}
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
            <td className="p-3 font-medium">{t("fleetName")}</td>
            <td className="p-3">{fleetName}</td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setDraft(fleetName);
                  setOpen(true);
                }}
              >
                {tc("edit")}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ModalShell open={open} title={t("editFleet")} onClose={() => setOpen(false)}>
        <Field label={t("fleetName")} preset="shortText" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => {
            setFleetName(draft.trim() || fleetName);
            setOpen(false);
          }}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </div>
  );
}
