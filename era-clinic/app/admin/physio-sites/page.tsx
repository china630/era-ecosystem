"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  Field,
  FieldTextarea,
  FORM_STACK_CLASS,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { BODY_PART_CODES } from "@/lib/body-part-codes";
import { PHYSIO_SITE_KINDS } from "@/domain/physio/physio-catalog";

type Tab = "sites" | "programs" | "substances" | "queue";

type AliasRow = { id: string; alias: string };

type SiteRow = {
  id: string;
  code: string;
  kind: string;
  prikaz817: number | null;
  laterality: boolean;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  titleLa: string;
  boundary: string | null;
  coarse: string[];
  sortOrder: number;
  active: boolean;
  aliases: AliasRow[];
};

type QueueRow = {
  id: string;
  sampleRaw: string;
  residue: string;
  bucket: string;
  sampleProcedureName: string | null;
  hitCount: number;
  status: string;
  suggestedSiteCode: string | null;
};

type ListRow = {
  id: string;
  listKind: string;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  sortOrder: number;
  active: boolean;
  aliases: AliasRow[];
};

function emptySite(): Omit<SiteRow, "id" | "aliases"> & { aliasesText: string } {
  return {
    code: "",
    kind: "USSR-817",
    prikaz817: null,
    laterality: false,
    titleAz: "",
    titleRu: "",
    titleEn: "",
    titleLa: "",
    boundary: "",
    coarse: ["BACK"],
    sortOrder: 0,
    active: true,
    aliasesText: "",
  };
}

function emptyList(): Omit<ListRow, "id" | "aliases" | "listKind"> & { aliasesText: string } {
  return {
    code: "",
    titleAz: "",
    titleRu: "",
    titleEn: "",
    sortOrder: 0,
    active: true,
    aliasesText: "",
  };
}

function aliasesToText(rows: AliasRow[] | undefined): string {
  return (rows ?? []).map((a) => a.alias).join("\n");
}

function textToAliases(text: string): string[] {
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export default function PhysioSitesAdminPage() {
  const t = useTranslations("physioSites");
  const tc = useTranslations("common");
  const formId = useId();
  const [tab, setTab] = useState<Tab>("sites");
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editSite, setEditSite] = useState<SiteRow | null>(null);
  const [editList, setEditList] = useState<ListRow | null>(null);
  const [siteForm, setSiteForm] = useState(emptySite);
  const [listForm, setListForm] = useState(emptyList);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [queueStatus, setQueueStatus] = useState("OPEN");
  const [aliasSiteById, setAliasSiteById] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedSites = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sites.slice(start, start + pageSize);
  }, [sites, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [tab, qDebounced, pageSize]);

  const listKind = tab === "programs" ? "DEVICE_PROGRAM" : tab === "substances" ? "SUBSTANCE" : null;

  const load = useCallback(async () => {
    setMsg(null);
    if (tab === "queue") {
      const params = new URLSearchParams({ status: queueStatus });
      if (qDebounced) params.set("q", qDebounced);
      const [qRes, sRes] = await Promise.all([
        fetch(`/api/admin/physio-nahiye-queue?${params}`),
        fetch("/api/admin/physio-sites?activeOnly=1"),
      ]);
      const qData = await qRes.json();
      const sData = await sRes.json();
      setQueue(Array.isArray(qData) ? qData : qData.data ?? []);
      setSites(Array.isArray(sData) ? sData : sData.data ?? []);
      return;
    }
    if (tab === "sites") {
      const params = new URLSearchParams();
      if (qDebounced) params.set("q", qDebounced);
      const res = await fetch(`/api/admin/physio-sites?${params}`);
      const data = await res.json();
      setSites(Array.isArray(data) ? data : data.data ?? []);
      return;
    }
    if (!listKind) return;
    const params = new URLSearchParams({ kind: listKind });
    if (qDebounced) params.set("q", qDebounced);
    const res = await fetch(`/api/admin/physio-lists?${params}`);
    const data = await res.json();
    setLists(Array.isArray(data) ? data : data.data ?? []);
  }, [tab, qDebounced, listKind, queueStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const coarseOptions = useMemo(
    () => BODY_PART_CODES.map((code) => ({ value: code, label: code })),
    [],
  );
  const kindOptions = useMemo(
    () => PHYSIO_SITE_KINDS.map((code) => ({ value: code, label: code })),
    [],
  );
  const sitePickOptions = useMemo(
    () => sites.map((s) => ({ value: s.id, label: `${s.code} · ${s.titleAz}` })),
    [sites],
  );
  const queueStatusOptions = useMemo(
    () => [
      { value: "OPEN", label: t("queueOpen") },
      { value: "RESOLVED", label: t("queueResolved") },
      { value: "NOT_ANATOMY", label: t("queueNotAnatomy") },
    ],
    [t],
  );

  useEffect(() => {
    setAliasSiteById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of queue) {
        if (next[row.id] || !row.suggestedSiteCode) continue;
        const hit = sites.find((s) => s.code === row.suggestedSiteCode);
        if (hit) {
          next[row.id] = hit.id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [queue, sites]);

  function openCreate() {
    setMsg(null);
    if (tab === "sites") {
      setEditSite(null);
      setSiteForm(emptySite());
    } else {
      setEditList(null);
      setListForm(emptyList());
    }
    setOpen(true);
  }

  function openSite(row: SiteRow) {
    setEditSite(row);
    setSiteForm({
      code: row.code,
      kind: row.kind,
      prikaz817: row.prikaz817,
      laterality: row.laterality,
      titleAz: row.titleAz,
      titleRu: row.titleRu,
      titleEn: row.titleEn,
      titleLa: row.titleLa,
      boundary: row.boundary ?? "",
      coarse: row.coarse,
      sortOrder: row.sortOrder,
      active: row.active,
      aliasesText: aliasesToText(row.aliases),
    });
    setOpen(true);
  }

  function openList(row: ListRow) {
    setEditList(row);
    setListForm({
      code: row.code,
      titleAz: row.titleAz,
      titleRu: row.titleRu,
      titleEn: row.titleEn,
      sortOrder: row.sortOrder,
      active: row.active,
      aliasesText: aliasesToText(row.aliases),
    });
    setOpen(true);
  }

  async function saveSite() {
    setBusy(true);
    setMsg(null);
    const payload = {
      kind: siteForm.kind,
      prikaz817: siteForm.prikaz817,
      laterality: siteForm.laterality,
      titleAz: siteForm.titleAz,
      titleRu: siteForm.titleRu,
      titleEn: siteForm.titleEn,
      titleLa: siteForm.titleLa,
      boundary: siteForm.boundary || null,
      coarse: siteForm.coarse,
      sortOrder: Number(siteForm.sortOrder) || 0,
      aliases: textToAliases(siteForm.aliasesText),
      ...(editSite ? { active: siteForm.active } : { code: siteForm.code }),
    };
    const res = await fetch(
      editSite ? `/api/admin/physio-sites/${editSite.id}` : "/api/admin/physio-sites",
      {
        method: editSite ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg((data as { error?: string }).error ?? tc("saveFailed"));
      return;
    }
    setOpen(false);
    await load();
  }

  async function saveList() {
    if (!listKind) return;
    setBusy(true);
    setMsg(null);
    const payload = {
      titleAz: listForm.titleAz,
      titleRu: listForm.titleRu,
      titleEn: listForm.titleEn,
      sortOrder: Number(listForm.sortOrder) || 0,
      aliases: textToAliases(listForm.aliasesText),
      ...(editList ? { active: listForm.active } : { listKind, code: listForm.code }),
    };
    const res = await fetch(
      editList ? `/api/admin/physio-lists/${editList.id}` : "/api/admin/physio-lists",
      {
        method: editList ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg((data as { error?: string }).error ?? tc("saveFailed"));
      return;
    }
    setOpen(false);
    await load();
  }

  async function queuePatch(id: string, action: "ignore" | "alias") {
    setBusy(true);
    setMsg(null);
    const body: { action: "ignore" | "alias"; siteId?: string } = { action };
    if (action === "alias") {
      const siteId = aliasSiteById[id];
      if (!siteId) {
        setBusy(false);
        setMsg(t("pickSiteFirst"));
        return;
      }
      body.siteId = siteId;
    }
    const res = await fetch(`/api/admin/physio-nahiye-queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg((data as { error?: string }).error ?? tc("failed"));
      return;
    }
    await load();
  }

  async function retireCurrent() {
    const url =
      tab === "sites" && editSite
        ? `/api/admin/physio-sites/${editSite.id}`
        : editList
          ? `/api/admin/physio-lists/${editList.id}`
          : null;
    if (!url) return;
    if (!window.confirm(t("confirmRetire"))) return;
    setBusy(true);
    const res = await fetch(url, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg((data as { error?: string }).error ?? tc("failed"));
      return;
    }
    setOpen(false);
    await load();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "sites", label: t("tabSites") },
    { id: "programs", label: t("tabPrograms") },
    { id: "substances", label: t("tabSubstances") },
    { id: "queue", label: t("tabQueue") },
  ];

  const rows = tab === "sites" ? sites : lists;
  const editing = tab === "sites" ? editSite : editList;

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          tab === "queue" ? null : (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {tc("add")}
            </button>
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setQ("");
          setQueueStatus("OPEN");
        }}
      >
        <Field
          label={tc("search")}
          preset="shortText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {tab === "queue" ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("queueStatus")}
            value={queueStatus}
            onChange={(next) => setQueueStatus(String(next) || "OPEN")}
            options={queueStatusOptions}
          />
        ) : null}
      </EraListFilterBar>
      {msg ? <p className="text-[13px] text-[#E74C3C]">{msg}</p> : null}
      {tab === "queue" ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sampleRaw")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("residue")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bucket")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("hitCount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedure")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("addAlias")}</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t("queueEmpty")}
                  </td>
                </tr>
              ) : (
                queue.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.sampleRaw}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.residue}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.bucket}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.hitCount}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.sampleProcedureName ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex min-w-[16rem] flex-col gap-2">
                        <CatalogField
                          kind="SEARCHABLE"
                          label={t("site")}
                          value={aliasSiteById[row.id] ?? ""}
                          onChange={(next) =>
                            setAliasSiteById((s) => ({ ...s, [row.id]: String(next) }))
                          }
                          options={sitePickOptions}
                          emptyLabel={null}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() => void queuePatch(row.id, "alias")}
                          >
                            {t("addAlias")}
                          </button>
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() => void queuePatch(row.id, "ignore")}
                          >
                            {t("ignoreNotAnatomy")}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
              {tab === "sites" ? (
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("kind")}</th>
              ) : null}
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("aliases")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("active")}</th>
            </tr>
          </thead>
          <tbody>
            {(tab === "sites" ? pagedSites : rows).map((row) => (
              <tr
                key={row.id}
                className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                onClick={() => {
                  if (tab === "sites") openSite(row as SiteRow);
                  else openList(row as ListRow);
                }}
              >
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {"titleLa" in row && row.titleLa
                    ? `${row.titleAz} / ${row.titleLa}`
                    : row.titleAz}
                </td>
                {tab === "sites" ? (
                  <td className={DATA_TABLE_TD_CLASS}>{(row as SiteRow).kind}</td>
                ) : null}
                <td className={DATA_TABLE_TD_CLASS}>{row.aliases?.length ?? 0}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.active ? t("yes") : t("no")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tab === "sites" ? (
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={sites.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      ) : null}
      </>
      )}

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? tc("edit") : tc("add")}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setOpen(false)}
            busy={busy}
            submitLabel={editing ? tc("save") : tc("add")}
          />
        }
      >
        <form
          id={formId}
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            if (tab === "sites") void saveSite();
            else void saveList();
          }}
        >
          {tab === "sites" ? (
            <>
              <Field
                label={t("code")}
                preset="code"
                value={siteForm.code}
                onChange={(e) => setSiteForm((s) => ({ ...s, code: e.target.value }))}
                required
                readOnly={Boolean(editSite)}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("kind")}
                value={siteForm.kind}
                onChange={(next) => setSiteForm((s) => ({ ...s, kind: String(next) }))}
                options={kindOptions}
                required
              />
              <CatalogField
                kind="MULTI"
                label={t("coarse")}
                value={siteForm.coarse}
                onChange={(next) =>
                  setSiteForm((s) => ({ ...s, coarse: Array.isArray(next) ? next : [String(next)] }))
                }
                options={coarseOptions}
                required
              />
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={siteForm.laterality}
                  onChange={(e) => setSiteForm((s) => ({ ...s, laterality: e.target.checked }))}
                />
                {t("laterality")}
              </label>
              <Field
                label={t("titleAz")}
                preset="shortText"
                value={siteForm.titleAz}
                onChange={(e) => setSiteForm((s) => ({ ...s, titleAz: e.target.value }))}
                required
              />
              <Field
                label={t("titleRu")}
                preset="shortText"
                value={siteForm.titleRu}
                onChange={(e) => setSiteForm((s) => ({ ...s, titleRu: e.target.value }))}
                required
              />
              <Field
                label={t("titleEn")}
                preset="shortText"
                value={siteForm.titleEn}
                onChange={(e) => setSiteForm((s) => ({ ...s, titleEn: e.target.value }))}
                required
              />
              <Field
                label={t("titleLa")}
                preset="shortText"
                value={siteForm.titleLa}
                onChange={(e) => setSiteForm((s) => ({ ...s, titleLa: e.target.value }))}
                required
              />
              <FieldTextarea
                label={t("boundary")}
                value={siteForm.boundary ?? ""}
                onChange={(e) => setSiteForm((s) => ({ ...s, boundary: e.target.value }))}
                rows={3}
              />
              <Field
                label={t("sortOrder")}
                preset="count"
                type="number"
                value={siteForm.sortOrder}
                onChange={(e) => setSiteForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))}
              />
              <FieldTextarea
                label={t("aliases")}
                hint={t("aliasesHint")}
                value={siteForm.aliasesText}
                onChange={(e) => setSiteForm((s) => ({ ...s, aliasesText: e.target.value }))}
                rows={6}
              />
              {editSite ? (
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    className={MODAL_CHECKBOX_CLASS}
                    checked={siteForm.active}
                    onChange={(e) => setSiteForm((s) => ({ ...s, active: e.target.checked }))}
                  />
                  {t("active")}
                </label>
              ) : null}
            </>
          ) : (
            <>
              <Field
                label={t("code")}
                preset="code"
                value={listForm.code}
                onChange={(e) => setListForm((s) => ({ ...s, code: e.target.value }))}
                required
                readOnly={Boolean(editList)}
              />
              <Field
                label={t("titleAz")}
                preset="shortText"
                value={listForm.titleAz}
                onChange={(e) => setListForm((s) => ({ ...s, titleAz: e.target.value }))}
                required
              />
              <Field
                label={t("titleRu")}
                preset="shortText"
                value={listForm.titleRu}
                onChange={(e) => setListForm((s) => ({ ...s, titleRu: e.target.value }))}
                required
              />
              <Field
                label={t("titleEn")}
                preset="shortText"
                value={listForm.titleEn}
                onChange={(e) => setListForm((s) => ({ ...s, titleEn: e.target.value }))}
                required
              />
              <Field
                label={t("sortOrder")}
                preset="count"
                type="number"
                value={listForm.sortOrder}
                onChange={(e) => setListForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))}
              />
              <FieldTextarea
                label={t("aliases")}
                hint={t("aliasesHint")}
                value={listForm.aliasesText}
                onChange={(e) => setListForm((s) => ({ ...s, aliasesText: e.target.value }))}
                rows={6}
              />
              {editList ? (
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    className={MODAL_CHECKBOX_CLASS}
                    checked={listForm.active}
                    onChange={(e) => setListForm((s) => ({ ...s, active: e.target.checked }))}
                  />
                  {t("active")}
                </label>
              ) : null}
            </>
          )}
          {editing && (tab === "sites" ? editSite?.active : editList?.active) ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void retireCurrent()}
            >
              {t("retire")}
            </button>
          ) : null}
        </form>
      </ModalShell>
    </div>
  );
}
