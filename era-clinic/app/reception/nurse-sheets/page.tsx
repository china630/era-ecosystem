"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@/lib/baku-day";

type Option = { value: string; label: string };

export default function ReceptionNurseSheetsPage() {
  const t = useTranslations("receptionSheets");
  const locale = useLocale();
  const [date, setDate] = useState(todayBakuYmd());
  const [slice, setSlice] = useState("ALL");
  const [staffId, setStaffId] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [staff, setStaff] = useState<Option[]>([]);
  const [procedures, setProcedures] = useState<Option[]>([]);

  useEffect(() => {
    void fetch("/api/reception/nurse-sheets/options")
      .then(async (res) => {
        if (!res.ok) {
          showApiError(await res.json().catch(() => ({})));
          return;
        }
        const body = (await res.json()) as {
          staff?: { id: string; fullName: string }[];
          procedures?: { code: string; name: string }[];
        };
        setStaff((body.staff ?? []).map((row) => ({ value: row.id, label: row.fullName })));
        setProcedures(
          (body.procedures ?? []).map((row) => ({ value: row.code, label: row.name })),
        );
      })
      .catch(() => showApiError({ error: t("loadFailed") }));
  }, [t]);

  function printSheet() {
    if (slice === "STAFF" && !staffId) {
      showApiError({ error: t("pickStaff") });
      return;
    }
    if (slice === "PROCEDURE" && !procedureCode) {
      showApiError({ error: t("pickProcedure") });
      return;
    }
    const params = new URLSearchParams({ date, lang: locale, autoprint: "1", slice });
    if (slice === "STAFF") params.set("practitionerId", staffId);
    if (slice === "PROCEDURE") params.set("procedureCode", procedureCode);
    window.open(`/print/reception-day?${params.toString()}`, "_blank", "noopener");
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mt-4 grid max-w-xl gap-3">
        <label className="grid gap-1 text-sm">
          <span>{t("date")}</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("slice")}
          value={slice}
          options={[
            { value: "ALL", label: t("allStaff") },
            { value: "STAFF", label: t("oneStaff") },
            { value: "PROCEDURE", label: t("oneProcedure") },
          ]}
          onChange={(value) => setSlice(value === "STAFF" || value === "PROCEDURE" ? value : "ALL")}
        />
        {slice === "STAFF" ? (
          <CatalogField
            kind="SEARCHABLE"
            label={t("staff")}
            value={staffId}
            options={staff}
            onChange={(value) => setStaffId(typeof value === "string" ? value : "")}
          />
        ) : null}
        {slice === "PROCEDURE" ? (
          <CatalogField
            kind="SEARCHABLE"
            label={t("procedure")}
            value={procedureCode}
            options={procedures}
            onChange={(value) => setProcedureCode(typeof value === "string" ? value : "")}
          />
        ) : null}
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={printSheet}>
          {t("print")}
        </button>
      </div>
    </div>
  );
}
