"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CatalogField } from "@era/satellite-kit/ui";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../../lib/role-utils";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import type { ExtraFieldDefRow } from "../../../components/extra-fields/extra-attributes-block";

const VALUE_KINDS = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"] as const;

export default function ExtraFieldsSettingsPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { user } = useAuth();
  const perms = useOrgPermissions();
  const canEdit = perms.can(CP_PERMISSION.ADMIN_ORG_SETTINGS);

  const [rows, setRows] = useState<ExtraFieldDefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("vehicle_plate");
  const [valueKind, setValueKind] = useState<(typeof VALUE_KINDS)[number]>("TEXT");
  const [labelAz, setLabelAz] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [labelRu, setLabelRu] = useState("");
  const [required, setRequired] = useState(false);
  const [selectOptions, setSelectOptions] = useState("BAKU,GANJA");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/extra-fields?entityType=FINANCE_INVOICE");
    if (res.ok) {
      const list = (await res.json()) as ExtraFieldDefRow[];
      setRows(Array.isArray(list) ? list : []);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (ready && token && canEdit) void load();
  }, [ready, token, load, canEdit]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const options =
      valueKind === "SELECT"
        ? selectOptions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((value) => ({ value, labelAz: value, labelEn: value, labelRu: value }))
        : undefined;
    const res = await apiFetch("/api/extra-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "FINANCE_INVOICE",
        key: key.trim(),
        valueKind,
        labelAz,
        labelEn,
        labelRu,
        required,
        options,
      }),
    });
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    setKey("");
    setLabelAz("");
    setLabelEn("");
    setLabelRu("");
    setRequired(false);
    await load();
  }

  async function toggleActive(row: ExtraFieldDefRow) {
    const res = await apiFetch(`/api/extra-fields/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    await load();
  }

  if (!ready) return null;
  if (!canEdit) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("extraFields.pageTitle")}
          subtitle={t("extraFields.pageHint")}
        />
        <p className="text-sm text-[#7F8C8D]">{t("extraFields.adminOnly")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("extraFields.pageTitle")}
        subtitle={t("extraFields.pageHint")}
      />
      <section className={CARD_CONTAINER_CLASS}>
        {loading ? <p>{t("common.loading")}</p> : null}
        <ul className="m-0 list-none space-y-2 p-0">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EBEDF0] py-2 text-sm"
            >
              <span>
                <code>{r.key}</code> · {r.valueKind}
                {r.required ? ` · ${t("extraFields.required")}` : ""}
                {!r.active ? ` · ${t("extraFields.retired")}` : ""}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void toggleActive(r)}
                >
                  {r.active ? t("extraFields.retire") : t("extraFields.restore")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {canEdit ? (
        <form className={`${CARD_CONTAINER_CLASS} space-y-3`} onSubmit={onCreate}>
          <h2 className="m-0 text-base font-semibold">{t("extraFields.add")}</h2>
          <label className="block text-sm">
            {t("extraFields.key")}
            <input
              className="mt-1 w-full rounded border border-[#D5DADF] px-2 py-1"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("extraFields.valueKind")}
            value={valueKind}
            onChange={(next) =>
              setValueKind(
                (typeof next === "string" ? next : "TEXT") as (typeof VALUE_KINDS)[number],
              )
            }
            options={VALUE_KINDS.map((v) => ({ value: v, label: v }))}
          />
          <label className="block text-sm">
            {t("extraFields.labelAz")}
            <input
              className="mt-1 w-full rounded border border-[#D5DADF] px-2 py-1"
              value={labelAz}
              onChange={(e) => setLabelAz(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            {t("extraFields.labelEn")}
            <input
              className="mt-1 w-full rounded border border-[#D5DADF] px-2 py-1"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            {t("extraFields.labelRu")}
            <input
              className="mt-1 w-full rounded border border-[#D5DADF] px-2 py-1"
              value={labelRu}
              onChange={(e) => setLabelRu(e.target.value)}
              required
            />
          </label>
          {valueKind === "SELECT" ? (
            <label className="block text-sm">
              {t("extraFields.selectOptions")}
              <input
                className="mt-1 w-full rounded border border-[#D5DADF] px-2 py-1"
                value={selectOptions}
                onChange={(e) => setSelectOptions(e.target.value)}
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            {t("extraFields.required")}
          </label>
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            {t("extraFields.add")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
