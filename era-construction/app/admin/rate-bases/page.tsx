"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";

type RateBaseRow = {
  id: string;
  code: string;
  title: string;
  version: number;
  _count?: { items: number };
};

type RateItem = {
  id: string;
  code: string;
  title: string;
  unit: string;
  kind: string;
  unitAmount: string | number;
  materialCode?: string | null;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function RateBasesAdminPage() {
  const t = useTranslations("adminRateBases");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");

  const [skuOn, setSkuOn] = useState(true);
  const [bases, setBases] = useState<RateBaseRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState<RateItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemUnit, setItemUnit] = useState("ед.");
  const [itemKind, setItemKind] = useState("COMPOSITE");
  const [itemAmount, setItemAmount] = useState("1");
  const [itemMaterialCode, setItemMaterialCode] = useState("");
  const [materialOptions, setMaterialOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [hubAvailable, setHubAvailable] = useState(true);

  const refresh = useCallback(async () => {
    const snap = await fetch("/api/platform/billing-snapshot")
      .then((r) => r.json())
      .catch(() => null);
    const mods: string[] = Array.isArray(snap?.activeModules) ? snap.activeModules : [];
    const tier = String(snap?.tier ?? "").toUpperCase();
    const on =
      tier === "TIER_3" || mods.includes("construction_smeta_rate_engine");
    setSkuOn(on);
    if (!on) {
      setBases([]);
      return;
    }
    const res = await apiJson<{ items: RateBaseRow[] }>("/api/rate-bases");
    if (!res.ok) {
      setMessage(res.error);
      setBases([]);
      return;
    }
    setBases(Array.isArray(res.data?.items) ? res.data.items : []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMaterials = useCallback(async (q?: string) => {
    if (!skuOn) return;
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const res = await apiJson<{
      materials: { code: string; nameEn?: string; nameRu?: string; nameAz?: string; uomCode?: string }[];
      hubAvailable?: boolean;
    }>(`/api/rate-engine/materials${qs}`);
    if (!res.ok) {
      setHubAvailable(false);
      setMaterialOptions([]);
      return;
    }
    setHubAvailable(res.data.hubAvailable !== false);
    setMaterialOptions(
      (res.data.materials ?? []).map((m) => ({
        value: m.code,
        label: `${m.code} — ${m.nameEn || m.nameRu || m.nameAz || m.code}${
          m.uomCode ? ` (${m.uomCode})` : ""
        }`,
      })),
    );
  }, [skuOn]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const loadBase = async (id: string) => {
    setSelectedId(id);
    setMessage("");
    const res = await apiJson<{
      id: string;
      items: RateItem[];
    }>(`/api/rate-bases/${id}`);
    if (!res.ok) {
      setMessage(res.error);
      setItems([]);
      return;
    }
    setItems(Array.isArray(res.data?.items) ? res.data.items : []);
  };

  const createBase = async () => {
    const trimmedCode = code.trim();
    const trimmedTitle = title.trim();
    if (!trimmedCode || !trimmedTitle) {
      setMessage(t("codeTitleRequired"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await apiJson("/api/rate-bases", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: trimmedCode, title: trimmedTitle }),
      });
      if (!res.ok) throw new Error(res.error);
      setCreateOpen(false);
      setCode("");
      setTitle("");
      setMessage(t("baseCreated"));
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async () => {
    if (!selectedId) return;
    const trimmedCode = itemCode.trim();
    const trimmedTitle = itemTitle.trim();
    const trimmedUnit = itemUnit.trim();
    const amount = Number(itemAmount);
    if (!trimmedCode || !trimmedTitle) {
      setMessage(t("codeTitleRequired"));
      return;
    }
    if (!trimmedUnit) {
      setMessage(t("unitRequired"));
      return;
    }
    if (!(amount > 0) || Number.isNaN(amount)) {
      setMessage(t("amountMustBePositive"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await apiJson(`/api/rate-bases/${selectedId}/items`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          code: trimmedCode,
          title: trimmedTitle,
          unit: trimmedUnit,
          kind: itemKind,
          unitAmount: amount,
          materialCode: itemMaterialCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = String(res.error || "");
        if (/unitAmount must be positive/i.test(err)) {
          throw new Error(t("amountMustBePositive"));
        }
        throw new Error(err || tc("error"));
      }
      setItemCode("");
      setItemTitle("");
      setItemAmount("1");
      setItemMaterialCode("");
      setMessage(t("itemSaved"));
      await loadBase(selectedId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const kindLabel = (kind: string) => {
    if (kind === "LABOR") return t("kindLabor");
    if (kind === "MATERIAL") return t("kindMaterial");
    if (kind === "MACHINE") return t("kindMachine");
    return t("kindComposite");
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/admin/settings" className={SECONDARY_BUTTON_CLASS}>
            {tNav("settings")}
          </Link>
        }
      />
      {!skuOn ? (
        <div className="mt-4 rounded border border-[#F5B7B1] bg-[#FDEDEC] p-3 text-sm text-[#922B21]">
          <p>{t("skuOff")}</p>
          <p className="mt-1 text-[12px] text-[#7B241C]">{t("skuOffHint")}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => setCreateOpen(true)}
            >
              {t("newBase")}
            </button>
          </div>
          {message ? (
            <p className="mt-2 text-sm text-[#1A5276]" role="status">
              {message}
            </p>
          ) : null}
          {bases.length === 0 ? (
            <p className="mt-4 text-sm text-[#7F8C8D]">{t("noBases")}</p>
          ) : (
            <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
              <thead>
                <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
                  <th className="p-3">{t("code")}</th>
                  <th className="p-3">{t("titleCol")}</th>
                  <th className="p-3">{t("version")}</th>
                  <th className="p-3">{t("items")}</th>
                  <th className="p-3 text-right">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {bases.map((b) => (
                  <tr key={b.id} className="border-b border-[#EEF1F3]">
                    <td className="p-3 font-medium">{b.code}</td>
                    <td className="p-3">{b.title}</td>
                    <td className="p-3">{b.version}</td>
                    <td className="p-3">{b._count?.items ?? "—"}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void loadBase(b.id)}
                      >
                        {tc("edit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {selectedId ? (
            <div className={`${CARD_CONTAINER_CLASS} mt-6 p-4`}>
              <h2 className="text-base font-semibold">{t("itemsHeading")}</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-[#7F8C8D]">{t("noItems")}</p>
              ) : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
                      <th className="py-2 pr-2">{t("itemCode")}</th>
                      <th className="py-2 pr-2">{t("itemTitle")}</th>
                      <th className="py-2 pr-2">{t("itemUnit")}</th>
                      <th className="py-2 pr-2">{t("itemAmount")}</th>
                      <th className="py-2 pr-2">{t("itemKind")}</th>
                      <th className="py-2">{t("materialCode")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-[#EEF1F3]">
                        <td className="py-2 pr-2 font-medium">{it.code}</td>
                        <td className="py-2 pr-2">{it.title}</td>
                        <td className="py-2 pr-2">{it.unit}</td>
                        <td className="py-2 pr-2">{Number(it.unitAmount).toFixed(2)}</td>
                        <td className="py-2 pr-2">{kindLabel(it.kind)}</td>
                        <td className="py-2">{it.materialCode || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className={`${FORM_STACK_CLASS} mt-4`}>
                <FieldRow>
                  <Field
                    label={t("itemCode")}
                    preset="code"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                  />
                  <Field
                    label={t("itemTitle")}
                    preset="shortText"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                  />
                </FieldRow>
                <FieldRow>
                  <Field
                    label={t("itemUnit")}
                    preset="shortText"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                  />
                  <CatalogField
                    kind="CLOSED_SMALL"
                    label={t("itemKind")}
                    value={itemKind}
                    onChange={(v) => setItemKind(String(v))}
                    options={[
                      { value: "COMPOSITE", label: t("kindComposite") },
                      { value: "LABOR", label: t("kindLabor") },
                      { value: "MATERIAL", label: t("kindMaterial") },
                      { value: "MACHINE", label: t("kindMachine") },
                    ]}
                  />
                  <Field
                    label={t("itemAmount")}
                    preset="shortText"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(e.target.value)}
                    hint={t("itemAmountHint")}
                  />
                </FieldRow>
                {hubAvailable && materialOptions.length > 0 ? (
                  <CatalogField
                    kind="SEARCHABLE"
                    label={t("materialCode")}
                    value={itemMaterialCode}
                    onChange={(v) => setItemMaterialCode(String(v))}
                    onQueryChange={(q) => void loadMaterials(q)}
                    options={materialOptions}
                    hint={t("materialCodeHint")}
                    emptyLabel={t("materialCodeNone")}
                  />
                ) : (
                  <Field
                    label={t("materialCode")}
                    preset="code"
                    value={itemMaterialCode}
                    onChange={(e) => setItemMaterialCode(e.target.value)}
                    hint={hubAvailable ? t("materialCodeHint") : t("materialHubOff")}
                  />
                )}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy || !itemCode.trim() || !itemTitle.trim()}
                  onClick={() => void saveItem()}
                >
                  {t("saveItem")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
      <ModalShell open={createOpen} title={t("newBase")} onClose={() => setCreateOpen(false)}>
        <div className={FORM_STACK_CLASS}>
          <Field
            label={t("code")}
            preset="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Field
            label={t("titleCol")}
            preset="shortText"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <ModalFooter
          onCancel={() => setCreateOpen(false)}
          onSubmit={() => void createBase()}
          submitLabel={tc("save")}
          cancelLabel={tc("cancel")}
          busy={busy}
          submitDisabled={!code.trim() || !title.trim()}
        />
      </ModalShell>
    </div>
  );
}
