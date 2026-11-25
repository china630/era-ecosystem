"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";

type DietTableRow = {
  id: string;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  isActive: boolean;
};

export default function AdminDietTablesPage() {
  const t = useTranslations("diet");
  const [rows, setRows] = useState<DietTableRow[]>([]);
  const [code, setCode] = useState("");
  const [titleAz, setTitleAz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [titleEn, setTitleEn] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/diet-tables?includeInactive=1");
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("loadFailed"));
      return;
    }
    setRows((data.items ?? []) as DietTableRow[]);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTable() {
    const res = await fetch("/api/admin/diet-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, titleAz, titleRu, titleEn }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("createFailed"));
      return;
    }
    setCode("");
    setTitleAz("");
    setTitleRu("");
    setTitleEn("");
    await load();
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={t("adminTitle")}
        subtitle={t("adminSubtitle")}
        actions={
          <Link href="/print/diet-portions" className="text-sm underline">
            {t("printPortions")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mb-4 grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5`}>
        <Field
          label={t("code")}
          preset="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Field
          label={t("titleAz")}
          preset="shortText"
          value={titleAz}
          onChange={(e) => setTitleAz(e.target.value)}
        />
        <Field
          label={t("titleRu")}
          preset="shortText"
          value={titleRu}
          onChange={(e) => setTitleRu(e.target.value)}
        />
        <Field
          label={t("titleEn")}
          preset="shortText"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
        />
        <div className="flex items-end">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createTable()}>
            {t("addTable")}
          </button>
        </div>
      </div>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>
                {r.code} — {r.titleAz}
              </span>
              <span className="text-slate-500">{r.isActive ? t("active") : t("inactive")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}