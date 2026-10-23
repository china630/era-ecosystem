"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type PresetState = {
  edition: string;
  enabledPresets: string[];
  selectablePresets: string[];
};

const PRESET_LABEL_KEY: Record<string, string> = {
  cafe: "presetCafe",
  restaurant: "presetRestaurant",
  banquet: "presetBanquet",
};

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const tNav = useTranslations("nav");
  const [dayStart, setDayStart] = useState("05:00");
  const [dayOpen, setDayOpen] = useState(false);
  const [dayDraft, setDayDraft] = useState("05:00");
  const [presets, setPresets] = useState<PresetState | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState<string[]>([]);
  const [outlets, setOutlets] = useState<
    Array<{ id: string; code: string; name: string; revenueCenterCode: string; financeWarehouseCode?: string | null }>
  >([]);
  const [outletId, setOutletId] = useState("");
  const [revenueOptions, setRevenueOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [revenueNotice, setRevenueNotice] = useState("");
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [revenueDraft, setRevenueDraft] = useState("");
  const [warehouseDraft, setWarehouseDraft] = useState("");

  useEffect(() => {
    void fetch("/api/settings/business-day")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.businessDayStart === "string") setDayStart(d.businessDayStart);
      })
      .catch(() => undefined);
    void fetch("/api/outlets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = Array.isArray(d?.outlets) ? d.outlets : [];
        setOutlets(rows);
        setOutletId((prev) => prev || rows[0]?.id || "");
      })
      .catch(() => undefined);
    void fetch("/api/admin/hotel-revenue-codes")
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          setRevenueOptions([]);
          setRevenueNotice(
            r.status === 403
              ? t("revenueForbidden")
              : r.status === 409
                ? t("revenueNotLinked")
                : t("revenueUnavailable"),
          );
          return;
        }
        const codes = (body?.codes ?? body?.data?.codes ?? []) as Array<{ code: string; name: string }>;
        setRevenueOptions(
          codes.map((row) => ({
            value: row.code,
            label: row.name ? `${row.code} — ${row.name}` : row.code,
          })),
        );
        setRevenueNotice(codes.length === 0 ? t("revenueEmpty") : "");
      })
      .catch(() => setRevenueNotice(t("revenueUnavailable")));
    void fetch("/api/settings/presets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.enabledPresets)) setPresets(d as PresetState);
      })
      .catch(() => undefined);
  }, [t]);

  async function saveOutletRevenue() {
    const res = await fetch(`/api/outlets/${outletId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revenueCenterCode: revenueDraft.trim(),
        financeWarehouseCode: warehouseDraft.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("save"));
      return;
    }
    setOutlets((rows) =>
      rows.map((row) =>
        row.id === outletId
          ? { ...row, revenueCenterCode: revenueDraft.trim(), financeWarehouseCode: warehouseDraft.trim() || null }
          : row,
      ),
    );
    setRevenueOpen(false);
    showSuccess(t("saved"));
  }

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

  async function savePresets() {
    const res = await fetch("/api/settings/presets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledPresets: presetDraft }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("save"));
      return;
    }
    setPresets(data as PresetState);
    setPresetOpen(false);
    showSuccess(t("saved"));
    window.location.reload();
  }

  const presetLabel = (code: string) =>
    PRESET_LABEL_KEY[code] ? t(PRESET_LABEL_KEY[code]) : code;
  const canEditPresets = (presets?.selectablePresets.length ?? 0) > 1;

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
            <td className="p-3 font-medium">{t("outletRevenue")}</td>
            <td className="p-3">
              {outlets.find((row) => row.id === outletId)?.revenueCenterCode || "—"}
              {revenueNotice ? <p className="text-sm text-[#B7950B]">{revenueNotice}</p> : null}
              <p className="text-[12px] text-[#7F8C8D]">
                {t("outletWarehouse")}: {outlets.find((row) => row.id === outletId)?.financeWarehouseCode || t("outletWarehouseDefault")}
              </p>
            </td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={!outletId}
                onClick={() => {
                  const row = outlets.find((item) => item.id === outletId);
                  setRevenueDraft(row?.revenueCenterCode ?? "");
                  setWarehouseDraft(row?.financeWarehouseCode ?? "");
                  setRevenueOpen(true);
                }}
              >
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
          {presets ? (
            <tr className="border-t border-[#ECF0F1]">
              <td className="p-3 font-medium">{t("edition")}</td>
              <td className="p-3">
                {presets.edition === "kafe" ? t("editionKafe") : t("editionFnb")}
              </td>
              <td className="p-3" />
            </tr>
          ) : null}
          {presets ? (
            <tr className="border-t border-[#ECF0F1]">
              <td className="p-3 font-medium" title={t("presetsHint")}>
                {t("presets")}
              </td>
              <td className="p-3">{presets.enabledPresets.map(presetLabel).join(", ")}</td>
              <td className="p-3 text-right">
                {canEditPresets ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => {
                      setPresetDraft(
                        presets.enabledPresets.filter((p) => presets.selectablePresets.includes(p)),
                      );
                      setPresetOpen(true);
                    }}
                  >
                    {t("edit")}
                  </button>
                ) : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <ModalShell open={revenueOpen} title={t("outletRevenue")} onClose={() => setRevenueOpen(false)}>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("outletName")}
          options={outlets.map((row) => ({ value: row.id, label: `${row.code} — ${row.name}` }))}
          value={outletId}
          onChange={(next) => {
            const id = String(next ?? "");
            const row = outlets.find((item) => item.id === id);
            setOutletId(id);
            setRevenueDraft(row?.revenueCenterCode ?? "");
            setWarehouseDraft(row?.financeWarehouseCode ?? "");
          }}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t("outletRevenue")}
          options={
            revenueDraft && !revenueOptions.some((option) => option.value === revenueDraft)
              ? [{ value: revenueDraft, label: revenueDraft }, ...revenueOptions]
              : revenueOptions
          }
          value={revenueDraft}
          onChange={(next) => setRevenueDraft(String(next ?? ""))}
        />
        <CatalogField
          kind="FREE_TEXT"
          label={t("outletWarehouse")}
          value={warehouseDraft}
          onChange={(next) => setWarehouseDraft(String(next ?? ""))}
        />
        <ModalFooter
          onCancel={() => setRevenueOpen(false)}
          onSubmit={() => void saveOutletRevenue()}
          submitLabel={t("save")}
        />
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
      <ModalShell open={presetOpen} title={t("presets")} onClose={() => setPresetOpen(false)}>
        <CatalogField
          kind="MULTI"
          label={t("presets")}
          hint={t("presetsHint")}
          value={presetDraft}
          onChange={(next) => setPresetDraft(Array.isArray(next) ? next : next ? [next] : [])}
          options={(presets?.selectablePresets ?? []).map((code) => ({
            value: code,
            label: presetLabel(code),
          }))}
        />
        <ModalFooter
          onCancel={() => setPresetOpen(false)}
          onSubmit={() => void savePresets()}
          submitLabel={t("save")}
        />
      </ModalShell>
    </>
  );
}
