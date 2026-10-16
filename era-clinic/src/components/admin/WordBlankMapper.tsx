"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, Pencil, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  Field,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from "@era/satellite-kit/ui";

type Analyte = { code: string; labelAz: string; labelEn: string; labelRu: string };
type Panel = {
  id: string;
  code: string;
  serviceCode: string;
  category: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  analytes: Analyte[];
};
type Profile = {
  id: string;
  name: string;
  serviceCode: string | null;
  active: boolean;
  rows: Array<{ sourceLabel: string; analyteCode: string }>;
};
type WordRow = { label: string; value: string; norm: string };

function panelTitle(panel: Panel, locale: string): string {
  if (locale.startsWith("ru")) return panel.titleRu || panel.titleAz || panel.titleEn;
  if (locale.startsWith("en")) return panel.titleEn || panel.titleAz || panel.titleRu;
  return panel.titleAz || panel.titleEn || panel.titleRu;
}

function analyteTitle(row: Analyte, locale: string): string {
  if (locale.startsWith("ru")) return row.labelRu || row.labelAz || row.labelEn || row.code;
  if (locale.startsWith("en")) return row.labelEn || row.labelAz || row.labelRu || row.code;
  return row.labelAz || row.labelEn || row.labelRu || row.code;
}

function profileFor(panel: Panel, profiles: Profile[]): Profile | undefined {
  return (
    profiles.find((row) => row.serviceCode === panel.code) ??
    profiles.find((row) => Boolean(panel.serviceCode) && row.serviceCode === panel.serviceCode)
  );
}

export function WordBlankMapper() {
  const t = useTranslations("lisProfiles");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState(false);
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const [wordRows, setWordRows] = useState<WordRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPanel = useRef<Panel | null>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lab-blank-profiles");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(json, tc("loadingFailed"));
      return;
    }
    const body = (json.data ?? json) as { profiles?: Profile[]; panels?: Panel[] };
    setProfiles(Array.isArray(body.profiles) ? body.profiles : []);
    setPanels(Array.isArray(body.panels) ? body.panels : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return panels.filter((panel) => {
      const profile = profileFor(panel, profiles);
      const mapped = Boolean(profile && profile.rows.length > 0 && profile.active);
      const off = Boolean(profile && !profile.active);
      if (status === "mapped" && !mapped) return false;
      if (status === "unmapped" && (mapped || off || profile)) return false;
      if (status === "off" && !off) return false;
      if (!q) return true;
      const title = panelTitle(panel, locale).toLowerCase();
      return (
        title.includes(q) ||
        panel.code.toLowerCase().includes(q) ||
        panel.category.toLowerCase().includes(q)
      );
    });
  }, [panels, profiles, debouncedQuery, status, locale]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function openMapper(panel: Panel, rows: WordRow[], profile: Profile | undefined) {
    const next: Record<string, string> = {};
    const byLabel = new Map(
      (profile?.rows ?? []).map((row) => [row.analyteCode, row.sourceLabel]),
    );
    const wordLabels = new Set(rows.map((row) => row.label));
    for (const analyte of panel.analytes) {
      const saved = byLabel.get(analyte.code) ?? "";
      if (saved && (wordLabels.size === 0 || wordLabels.has(saved))) next[analyte.code] = saved;
      else {
        const title = analyteTitle(analyte, locale).trim().toLowerCase();
        const hit = rows.find((row) => row.label.trim().toLowerCase() === title);
        next[analyte.code] = hit?.label ?? "";
      }
    }
    setMapping(next);
    setWordRows(rows);
    setOpenPanel(panel);
  }

  async function readWord(panel: Panel, file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/lab-blank-profiles", { method: "PUT", body });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, t("uploadWord"));
        return;
      }
      const rows = (json.data?.rows ?? json.rows ?? []) as WordRow[];
      if (rows.length === 0) {
        showApiError({ error: t("wordEmpty") });
        return;
      }
      openMapper(panel, rows, profileFor(panel, profiles));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!openPanel) return;
    const rows = openPanel.analytes
      .map((analyte) => ({
        sourceLabel: (mapping[analyte.code] ?? "").trim(),
        analyteCode: analyte.code,
      }))
      .filter((row) => row.sourceLabel);
    if (rows.length === 0) {
      showApiError({ error: t("mapRequired") });
      return;
    }
    setBusy(true);
    try {
      const profile = profileFor(openPanel, profiles);
      const res = await fetch("/api/admin/lab-blank-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profile?.id,
          name: panelTitle(openPanel, locale),
          kind: "TABLE",
          serviceCode: openPanel.code,
          rows,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc("saveFailed"));
        return;
      }
      showSuccess(t("blankSaved"));
      setOpenPanel(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(profile: Profile) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/lab-blank-profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !profile.active }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc("failed"));
        return;
      }
      showSuccess(profile.active ? t("blankDeactivated") : t("blankActivated"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const wordOptions = wordRows.map((row) => ({
    value: row.label,
    label: row.value ? `${row.label} · ${row.value}` : row.label,
  }));

  return (
    <div className="space-y-3">
      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setQuery("");
          setStatus("all");
          setPage(1);
        }}
      >
        <Field
          preset="shortText"
          label={t("panelSearch")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("panelStatus")}
          value={status}
          onChange={(value) => {
            setStatus(String(value ?? "all"));
            setPage(1);
          }}
          options={[
            { value: "all", label: t("statusAll") },
            { value: "mapped", label: t("statusMapped") },
            { value: "unmapped", label: t("statusUnmapped") },
            { value: "off", label: t("statusOff") },
          ]}
        />
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("panelName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("panelCode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("blankStatus")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {t("noPanels")}
                  </td>
                </tr>
              ) : (
                pageRows.map((panel) => {
                  const profile = profileFor(panel, profiles);
                  const statusLabel = !profile
                    ? t("unmapped")
                    : profile.active
                      ? t("mapped")
                      : t("inactive");
                  return (
                    <tr key={panel.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>
                        {panelTitle(panel, locale)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{panel.code}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{statusLabel}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={t("uploadWord")}
                            disabled={busy}
                            onClick={() => {
                              pendingPanel.current = panel;
                              fileRef.current?.click();
                            }}
                          >
                            <Upload className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={t("editMap")}
                            disabled={busy || !profile}
                            onClick={() =>
                              openMapper(
                                panel,
                                (profile?.rows ?? []).map((row) => ({
                                  label: row.sourceLabel,
                                  value: "",
                                  norm: "",
                                })),
                                profile,
                              )
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={profile?.active ? t("deactivate") : t("activate")}
                            disabled={busy || !profile}
                            onClick={() => profile && void toggleActive(profile)}
                          >
                            {profile && !profile.active ? (
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Ban className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        aria-label={t("uploadWord")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const panel = pendingPanel.current;
          if (file && panel) void readWord(panel, file);
        }}
      />
      <ModalShell
        open={openPanel != null}
        title={openPanel ? panelTitle(openPanel, locale) : ""}
        onClose={() => setOpenPanel(null)}
        closeLabel={tc("close")}
        maxWidthClass="max-w-3xl w-full"
        footer={
          <ModalFooter
            onCancel={() => setOpenPanel(null)}
            onSubmit={() => void save()}
            busy={busy}
            submitLabel={tc("save")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <ul className="space-y-2">
          {(openPanel?.analytes ?? []).map((analyte) => (
            <li key={analyte.code} className="grid grid-cols-[1fr_16rem] items-center gap-2 text-sm">
              <span>
                {analyteTitle(analyte, locale)}
                <span className={`ml-1 ${TEXT_MUTED_CLASS}`}>({analyte.code})</span>
              </span>
              <CatalogField
                kind="SEARCHABLE"
                label={analyte.code}
                value={mapping[analyte.code] ?? ""}
                onChange={(value) =>
                  setMapping((current) => ({ ...current, [analyte.code]: String(value ?? "") }))
                }
                options={[{ value: "", label: "—" }, ...wordOptions]}
              />
            </li>
          ))}
        </ul>
      </ModalShell>
    </div>
  );
}
