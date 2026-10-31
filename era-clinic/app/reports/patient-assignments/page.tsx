"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";

type LedgerRow = {
  id: string;
  kind: "procedure" | "lab" | "visit";
  code: string;
  name: string;
  assigned: number;
  completed: number;
  scheduledAtLabel: string | null;
  roomNumber: string | null;
  amount: number;
};

type LedgerPayload = {
  episode: {
    id: string;
    patientLabel: string;
    roomNumber: string | null;
    programCode: string | null;
    status: string;
  };
  rooms: string[];
  rows: LedgerRow[];
  totals: { assigned: number; completed: number; amount: number };
};

export default function PatientAssignmentsReportPage() {
  const t = useTranslations("common");
  const tr = useTranslations("patientAssignmentReport");
  const tc = useTranslations("nav");

  const [patientId, setPatientId] = useState("");
  const [patientOptions, setPatientOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [episodeOptions, setEpisodeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [roomNumber, setRoomNumber] = useState("");
  const [kind, setKind] = useState("all");
  const [payload, setPayload] = useState<LedgerPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const kindOptions = useMemo(
    () => [
      { value: "all", label: tr("kindAll") },
      { value: "procedure", label: tr("kindProcedure") },
      { value: "lab", label: tr("kindLab") },
      { value: "visit", label: tr("kindVisit") },
    ],
    [tr],
  );

  const searchPatients = useCallback(
    async (q: string) => {
      const params = new URLSearchParams({
        pageSize: "20",
        page: "1",
        episodeStatus: "ALL",
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/patients?${params.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(body, tr("loadFailed"));
        return;
      }
      const items = Array.isArray(body.items) ? body.items : [];
      setPatientOptions(
        items.map(
          (row: {
            id: string;
            firstName?: string | null;
            lastName?: string | null;
            refCode?: string;
          }) => {
            const name = [row.lastName, row.firstName].filter(Boolean).join(" ").trim();
            return {
              value: row.id,
              label: name
                ? `${name} (${row.refCode ?? row.id})`
                : (row.refCode ?? row.id),
            };
          },
        ),
      );
    },
    [tr],
  );

  useEffect(() => {
    void searchPatients(patientQuery);
  }, [patientQuery, searchPatients]);

  useEffect(() => {
    if (!patientId) {
      setEpisodeOptions([]);
      setEpisodeId("");
      setPayload(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/patients/${patientId}/episodes`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          showApiError(body, tr("loadFailed"));
          return;
        }
        if (cancelled) return;
        const items = Array.isArray(body.items) ? body.items : [];
        const opts = items.map(
          (row: {
            id: string;
            status?: string;
            programCode?: string | null;
            roomNumber?: string | null;
            openedAt?: string;
          }) => {
            const bits = [
              row.status ?? "—",
              row.programCode || null,
              row.roomNumber ? `${tr("room")} ${row.roomNumber}` : null,
            ].filter(Boolean);
            return { value: row.id, label: bits.join(" · ") };
          },
        );
        setEpisodeOptions(opts);
        setEpisodeId((prev) =>
          opts.some((o: { value: string }) => o.value === prev)
            ? prev
            : (opts[0]?.value ?? ""),
        );
      })
      .catch(() => showApiError({ error: tr("loadFailed") }));
    return () => {
      cancelled = true;
    };
  }, [patientId, tr]);

  const reportUrl = useMemo(() => {
    if (!episodeId) return null;
    const params = new URLSearchParams({ episodeId });
    if (roomNumber) params.set("roomNumber", roomNumber);
    if (kind && kind !== "all") params.set("kind", kind);
    return `/api/reports/patient-assignments?${params.toString()}`;
  }, [episodeId, roomNumber, kind]);

  useEffect(() => {
    if (!reportUrl) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    void fetch(reportUrl)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          showApiError(body, tr("loadFailed"));
          return;
        }
        if (cancelled) return;
        setPayload(body as LedgerPayload);
      })
      .catch(() => showApiError({ error: tr("loadFailed") }))
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportUrl, tr]);

  const roomOptions = useMemo(() => {
    const rooms = payload?.rooms ?? [];
    return [
      { value: "", label: tr("roomAll") },
      ...rooms.map((r) => ({ value: r, label: r })),
    ];
  }, [payload?.rooms, tr]);

  const printHref = episodeId
    ? `/print/patient-assignments/${encodeURIComponent(episodeId)}${
        roomNumber || kind !== "all"
          ? `?${new URLSearchParams({
              ...(roomNumber ? { roomNumber } : {}),
              ...(kind !== "all" ? { kind } : {}),
            }).toString()}`
          : ""
      }`
    : null;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={tc("patientAssignmentReport")} subtitle={tr("subtitle")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={t("filterReset")}
            onReset={() => {
              setPatientId("");
              setEpisodeId("");
              setRoomNumber("");
              setKind("all");
              setPatientQuery("");
              setPayload(null);
            }}
          >
            <div className="min-w-[240px] flex-1">
              <CatalogField
                kind="SEARCHABLE"
                label={tr("patient")}
                value={patientId}
                onChange={(v) => setPatientId(String(v ?? ""))}
                options={patientOptions}
                onQueryChange={setPatientQuery}
                serverSearch
              />
            </div>
            <div className="min-w-[220px]">
              <CatalogField
                kind="CLOSED_MEDIUM"
                label={tr("episode")}
                value={episodeId}
                onChange={(v) => setEpisodeId(String(v ?? ""))}
                options={episodeOptions}
                disabled={!patientId || episodeOptions.length === 0}
              />
            </div>
            <div className="min-w-[140px]">
              <CatalogField
                kind="CLOSED_SMALL"
                label={tr("room")}
                value={roomNumber}
                onChange={(v) => setRoomNumber(String(v ?? ""))}
                options={roomOptions}
                disabled={!payload}
              />
            </div>
            <div className="min-w-[160px]">
              <CatalogField
                kind="CLOSED_SMALL"
                label={tr("kind")}
                value={kind}
                onChange={(v) => setKind(String(v ?? "all"))}
                options={kindOptions}
              />
            </div>
          </EraListFilterBar>
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
              {payload
                ? tr("headerLine", {
                    patient: payload.episode.patientLabel,
                    room: payload.episode.roomNumber || "—",
                    program: payload.episode.programCode || "—",
                  })
                : busy
                  ? t("loading")
                  : tr("pickEpisode")}
            </p>
            <button
              type="button"
              className={episodeId ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
              disabled={!episodeId}
              onClick={() => setPrintOpen(true)}
            >
              {tr("print")}
            </button>
          </div>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colAssigned")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colCompleted")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colWhen")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colRoom")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {!payload || payload.rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {busy ? t("loading") : tr("empty")}
                  </td>
                </tr>
              ) : (
                <>
                  {payload.rows.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="font-medium">{row.name}</div>
                        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                          {row.code} · {tr(`kind_${row.kind}`)}
                        </p>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.assigned}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.completed}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.scheduledAtLabel || "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.roomNumber || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.amount > 0 ? row.amount.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                      {tr("totals")}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                      {payload.totals.assigned}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                      {payload.totals.completed}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS} />
                    <td className={DATA_TABLE_TD_CLASS} />
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                      {payload.totals.amount.toFixed(2)} AZN
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        }
      />
      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
        title={tr("print")}
      />
    </div>
  );
}
