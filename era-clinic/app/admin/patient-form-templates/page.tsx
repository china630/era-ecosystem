"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type FormTemplate = {
  id: string;
  code: string;
  titleEn: string;
  consentRequired: boolean;
  active: boolean;
};

export default function AdminPatientFormTemplatesPage() {
  const t = useTranslations("patientFormAdmin");
  const [items, setItems] = useState<FormTemplate[]>([]);
  const [code, setCode] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/patient-form-templates?includeInactive=1");
    const body = (await res.json()) as { items?: FormTemplate[] };
    setItems(body.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setMessage("");
    const res = await fetch("/api/admin/patient-form-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        titleEn,
        titleRu: titleEn,
        titleAz: titleEn,
        sectionsJson: "[]",
        consentRequired: true,
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setMessage(body.error ?? t("createFailed"));
      return;
    }
    setCode("");
    setTitleEn("");
    setMessage(t("created"));
    await load();
  }

  return (
    <main className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="rounded border px-2 py-1 text-sm" placeholder={t("code")} value={code} onChange={(e) => setCode(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder={t("nameLabel")} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void create()}>
          {t("add")}
        </button>
      </div>
      {message ? <p className="mb-2 text-sm text-slate-600">{message}</p> : null}
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("nameLabel")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("consent")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
              <td className={DATA_TABLE_TD_CLASS}>{row.titleEn}</td>
              <td className={DATA_TABLE_TD_CLASS}>{row.consentRequired ? t("yes") : t("no")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}