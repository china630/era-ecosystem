"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import FbPosNav from "@/components/FbPosNav";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fnbCan } from "@/lib/auth/permission-check";
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

type OutletRow = {
  id: string;
  code: string;
  name: string;
  revenueCenterCode: string;
  financeWarehouseCode?: string | null;
  active?: boolean;
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
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [outletId, setOutletId] = useState("");
  const [revenueOptions, setRevenueOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [revenueNotice, setRevenueNotice] = useState("");
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [revenueDraft, setRevenueDraft] = useState("");
  const [warehouseDraft, setWarehouseDraft] = useState("");
  const [canManageOutlets, setCanManageOutlets] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [copyFromOutletId, setCopyFromOutletId] = useState("");

  function refreshOutlets() {
    return fetch("/api/outlets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = Array.isArray(d?.outlets) ? (d.outlets as OutletRow[]) : [];
        setOutlets(rows);
        setOutletId((prev) => prev || rows[0]?.id || "");
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    void fetch("/api/settings/business-day")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.businessDayStart === "string") setDayStart(d.businessDayStart);
      })
      .catch(() => undefined);
    void refreshOutlets();
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        setCanManageOutlets(fnbCan(me, PERMISSIONS.OUTLETS_MANAGE));
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

  async function createOutlet() {
    const code = createCode.trim().toUpperCase();
    const name = createName.trim();
    if (!code || !name) {
      showApiError({ error: t("outletCodeNameRequired") }, t("save"));
      return;
    }
    const res = await fetch("/api/outlets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        ...(copyFromOutletId ? { copyFromOutletId } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("createOutletFailed"));
      return;
    }
    setCreateOpen(false);
    setCreateCode("");
    setCreateName("");
    setCopyFromOutletId("");
    showSuccess(t("outletCreated"));
    await refreshOutlets();
    if (data?.id) setOutletId(data.id);
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

      <div className="mt-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#2C3E50]">{t("outletsTitle")}</h2>
        {canManageOutlets ? (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setCreateCode("");
              setCreateName("");
              setCopyFromOutletId(outletId || outlets[0]?.id || "");
              setCreateOpen(true);
            }}
          >
            {t("newOutlet")}
          </button>
        ) : null}
      </div>
      <table className={`${CARD_CONTAINER_CLASS} mt-2 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{t("outletCode")}</th>
            <th className="p-3">{t("outletName")}</th>
            <th className="p-3">{t("outletRevenue")}</th>
            <th className="p-3">{t("outletWarehouse")}</th>
            <th className="p-3 text-right">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {outlets.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-3 text-center text-[#7F8C8D]">
                {t("outletsEmpty")}
              </td>
            </tr>
          ) : (
            outlets.map((row) => (
              <tr key={row.id} className="border-t border-[#ECF0F1]">
                <td className="p-3 font-medium">{row.code}</td>
                <td className="p-3">{row.name}</td>
                <td className="p-3">{row.revenueCenterCode || "—"}</td>
                <td className="p-3">{row.financeWarehouseCode || t("outletWarehouseDefault")}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => {
                      setOutletId(row.id);
                      setRevenueDraft(row.revenueCenterCode ?? "");
                      setWarehouseDraft(row.financeWarehouseCode ?? "");
                      setRevenueOpen(true);
                    }}
                  >
                    {t("edit")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {revenueNotice ? <p className="mt-1 text-sm text-[#B7950B]">{revenueNotice}</p> : null}

      <table className={`${CARD_CONTAINER_CLASS} mt-6 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{t("field")}</th>
            <th className="p-3">{t("value")}</th>
            <th className="p-3 text-right">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">{t("businessDayStart")}</td>
            <td className="p-3">{dayStart}</td>
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

      <ModalShell open={createOpen} title={t("newOutlet")} onClose={() => setCreateOpen(false)}>
        <CatalogField
          kind="FREE_TEXT"
          label={t("outletCode")}
          options={[]}
          value={createCode}
          onChange={(next) => setCreateCode(String(next ?? ""))}
        />
        <CatalogField
          kind="FREE_TEXT"
          label={t("outletName")}
          options={[]}
          value={createName}
          onChange={(next) => setCreateName(String(next ?? ""))}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("copyMenuFrom")}
          hint={t("copyMenuFromHint")}
          options={[
            { value: "", label: t("copyMenuNone") },
            ...outlets.map((row) => ({ value: row.id, label: `${row.code} — ${row.name}` })),
          ]}
          value={copyFromOutletId}
          onChange={(next) => setCopyFromOutletId(String(next ?? ""))}
        />
        <ModalFooter
          onCancel={() => setCreateOpen(false)}
          onSubmit={() => void createOutlet()}
          submitLabel={t("save")}
        />
      </ModalShell>

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
          options={[]}
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
