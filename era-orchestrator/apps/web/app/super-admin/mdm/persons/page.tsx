"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { GitMerge, Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  GHOST_BUTTON_CLASS,
  ListPaginationFooter,
  MODAL_INPUT_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";

type PersonRow = {
  id: string;
  fullName: string | null;
  finMasked: string | null;
  phoneMasked: string | null;
  sex: string | null;
  birthDate: string | null;
  personSegment: string;
  mergedIntoPersonId: string | null;
  updatedAt: string;
};

const SEX_OPTIONS = [
  { value: "MALE", labelKey: "sexMale" as const },
  { value: "FEMALE", labelKey: "sexFemale" as const },
  { value: "UNKNOWN", labelKey: "sexUnknown" as const },
];

export default function SuperAdminMdmPersonsPage() {
  const t = useTranslations("superAdmin.mdmPersons");
  const tCommon = useTranslations("common");

  const [items, setItems] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterFin, setFilterFin] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterDob, setFilterDob] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [applied, setApplied] = useState({
    fin: "",
    fullName: "",
    birthDate: "",
    phone: "",
  });

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveFin, setResolveFin] = useState("");
  const [resolveName, setResolveName] = useState("");
  const [resolvePhone, setResolvePhone] = useState("");
  const [resolveSex, setResolveSex] = useState("UNKNOWN");
  const [resolveDob, setResolveDob] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (applied.fin.trim()) qs.set("fin", applied.fin.trim().toUpperCase());
    if (applied.fullName.trim()) qs.set("fullName", applied.fullName.trim());
    if (applied.birthDate.trim()) qs.set("birthDate", applied.birthDate.trim());
    if (applied.phone.trim()) qs.set("phone", applied.phone.trim());
    const res = await cpAdminFetch(`mdm/persons?${qs.toString()}`);
    if (!res.ok) {
      setError(await res.text());
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      total: number;
      items: PersonRow[];
    };
    setTotal(data.total ?? 0);
    setItems(data.items ?? []);
    setLoading(false);
  }, [page, pageSize, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    setPage(1);
    setApplied({
      fin: filterFin,
      fullName: filterName,
      birthDate: filterDob,
      phone: filterPhone,
    });
  }

  const sexOptions = useMemo(
    () =>
      SEX_OPTIONS.map((o) => ({
        value: o.value,
        label: t(o.labelKey),
      })),
    [t],
  );

  function formatSex(sex: string | null): string {
    if (!sex || sex === "UNKNOWN") return t("sexUnknown");
    if (sex === "MALE") return t("sexMale");
    if (sex === "FEMALE") return t("sexFemale");
    return sex;
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function openMergeFromSelection() {
    if (selectedIds.length !== 2) return;
    setMergeSourceId(selectedIds[0]);
    setMergeTargetId(selectedIds[1]);
    setMergeError(null);
    setMergeOpen(true);
  }

  function personLabel(id: string | null): string {
    if (!id) return "—";
    const row = items.find((x) => x.id === id);
    if (!row) return id.slice(0, 8);
    return `${row.fullName ?? "—"} (${row.finMasked ?? id.slice(0, 8)})`;
  }

  async function doResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveFin.trim() || !resolveName.trim()) return;
    setBusy(true);
    setResolveError(null);
    setMsg(null);
    const res = await cpAdminFetch("mdm/persons/resolve", {
      method: "POST",
      body: JSON.stringify({
        fin: resolveFin.trim().toUpperCase(),
        fullName: resolveName.trim(),
        phone: resolvePhone.trim() || undefined,
        sex: resolveSex || undefined,
        birthDate: resolveDob || undefined,
        nationality: "AZ",
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setResolveError(
        typeof data.message === "string" ? data.message : t("resolveFailed"),
      );
      return;
    }
    setMsg(t("resolveOk", { id: data.globalPersonId ?? data.id ?? "?" }));
    setResolveOpen(false);
    setResolveFin("");
    setResolveName("");
    setResolvePhone("");
    setResolveSex("UNKNOWN");
    setResolveDob("");
    await load();
  }

  async function doMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) {
      return;
    }
    if (!window.confirm(t("mergeConfirm"))) return;
    setBusy(true);
    setMergeError(null);
    setMsg(null);
    const res = await cpAdminFetch("mdm/persons/merge", {
      method: "POST",
      body: JSON.stringify({
        sourcePersonId: mergeSourceId,
        targetPersonId: mergeTargetId,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMergeError(
        typeof data.message === "string" ? data.message : t("mergeFailed"),
      );
      return;
    }
    setMsg(t("mergeOk", { id: data.globalPersonId ?? mergeTargetId }));
    setMergeOpen(false);
    setSelectedIds([]);
    setMergeSourceId(null);
    setMergeTargetId(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/super-admin/mdm" className="text-sm text-[#2980B9]">
            ← {t("backHub")}
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[#7F8C8D]">{t("hint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={selectedIds.length !== 2}
            onClick={openMergeFromSelection}
          >
            <GitMerge className="mr-1.5 h-4 w-4" aria-hidden />
            {t("mergeBtn")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setResolveError(null);
              setResolveOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addPerson")}
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => applyFilters(e)}
        className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3 p-4`}
      >
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterFin")}
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 block w-36`}
            value={filterFin}
            onChange={(e) => setFilterFin(e.target.value.toUpperCase())}
            placeholder={t("finPlaceholder")}
            maxLength={7}
          />
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterName")}
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 block w-48`}
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
          />
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterDob")}
          <input
            type="date"
            className={`${MODAL_INPUT_CLASS} mt-1 block`}
            value={filterDob}
            onChange={(e) => setFilterDob(e.target.value)}
          />
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterPhone")}
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 block w-40`}
            value={filterPhone}
            onChange={(e) => setFilterPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
          />
        </label>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={loading}>
          {t("applyFilters")}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {selectedIds.length > 0 ? (
        <p className="text-xs text-[#7F8C8D]">
          {t("selectionHint", { count: selectedIds.length })}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>
          {t("empty")}
        </div>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSelect")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("fullName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFin")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("phone")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sex")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("birthDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSegment")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      aria-label={t("colSelect")}
                    />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.fullName ?? "—"}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                    {r.finMasked ?? "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {r.phoneMasked ?? "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{formatSex(r.sex)}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                    {r.birthDate ?? "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.personSegment}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      title={t("mergeAsSource")}
                      aria-label={t("mergeAsSource")}
                      onClick={() => {
                        setMergeSourceId(r.id);
                        setMergeTargetId(
                          selectedIds.find((id) => id !== r.id) ?? null,
                        );
                        setMergeError(null);
                        setMergeOpen(true);
                      }}
                    >
                      <GitMerge
                        className="h-4 w-4 text-[#C0392B]"
                        aria-hidden
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            labels={{
              rowsPerPage: tCommon("paginationRowsPerPage"),
              pageOf: tCommon("paginationPageOf"),
              prev: tCommon("paginationPrev"),
              next: tCommon("paginationNext"),
            }}
          />
        </div>
      )}

      <ModalShell
        open={resolveOpen}
        title={t("resolveTitle")}
        onClose={() => !busy && setResolveOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void doResolve(e)} className="grid gap-3">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("filterFin")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={resolveFin}
              onChange={(e) => setResolveFin(e.target.value.toUpperCase())}
              placeholder={t("finPlaceholder")}
              maxLength={7}
              required
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fullName")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={resolveName}
              onChange={(e) => setResolveName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              required
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("phone")}
            <input
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={resolvePhone}
              onChange={(e) => setResolvePhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
            />
          </label>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("sex")}
            value={resolveSex}
            onChange={(next) => setResolveSex(String(next))}
            options={sexOptions}
            emptyLabel={null}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("birthDate")}
            <input
              type="date"
              className={`${MODAL_INPUT_CLASS} mt-1 w-full`}
              value={resolveDob}
              onChange={(e) => setResolveDob(e.target.value)}
            />
          </label>
          {resolveError ? (
            <p className="text-sm text-red-700">{resolveError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setResolveOpen(false)}
              disabled={busy}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {busy ? tCommon("loading") : t("resolveBtn")}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={mergeOpen}
        title={t("mergeTitle")}
        onClose={() => !busy && setMergeOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void doMerge(e)} className="grid gap-3">
          <p className="text-xs text-[#7F8C8D]">{t("mergeHint")}</p>
          <CatalogField
            kind="ENTITY_REF"
            label={t("mergeSource")}
            value={mergeSourceId ?? ""}
            onChange={(next) => setMergeSourceId(String(next) || null)}
            options={items.map((r) => ({
              value: r.id,
              label: `${r.fullName ?? "—"} · ${r.finMasked ?? r.id.slice(0, 8)}`,
            }))}
            emptyLabel={t("selectPerson")}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("mergeTarget")}
            value={mergeTargetId ?? ""}
            onChange={(next) => setMergeTargetId(String(next) || null)}
            options={items.map((r) => ({
              value: r.id,
              label: `${r.fullName ?? "—"} · ${r.finMasked ?? r.id.slice(0, 8)}`,
            }))}
            emptyLabel={t("selectPerson")}
          />
          {mergeSourceId && mergeTargetId ? (
            <p className="rounded-lg bg-[#FAFBFC] p-3 text-xs text-[#34495E]">
              {t("mergePreview", {
                source: personLabel(mergeSourceId),
                target: personLabel(mergeTargetId),
              })}
            </p>
          ) : null}
          {mergeError ? (
            <p className="text-sm text-red-700">{mergeError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setMergeOpen(false)}
              disabled={busy}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              className={`${GHOST_BUTTON_CLASS} border border-[#E74C3C] text-[#E74C3C]`}
              disabled={
                busy ||
                !mergeSourceId ||
                !mergeTargetId ||
                mergeSourceId === mergeTargetId
              }
            >
              {busy ? tCommon("loading") : t("mergeBtn")}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
