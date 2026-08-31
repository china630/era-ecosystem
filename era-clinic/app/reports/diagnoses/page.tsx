"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  FieldSelect,
  ListPaginationFooter,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type Row = {
  code: string;
  chapterCode: string;
  title: string;
  episode: number;
  visit: number;
  admission: number;
  total: number;
  practitioners: string[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function DiagnosisReportPage() {
  const t = useTranslations("icd");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [from, setFrom] = useState(monthAgoIso());
  const [to, setTo] = useState(todayIso());
  const [source, setSource] = useState("all");
  const [chapter, setChapter] = useState("");
  const [chapters, setChapters] = useState<Array<{ code: string; title: string }>>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [from, to, source, chapter, pageSize]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/icd?chapters=1&locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setChapters(d.chapters ?? d.data?.chapters ?? []);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg("");
    const params = new URLSearchParams({ from, to, source, locale });
    if (chapter) params.set("chapter", chapter);
    const res = await fetch(`/api/reports/diagnoses?${params}`);
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? tc("failed"));
      return;
    }
    setItems(data.items ?? data.data?.items ?? []);
    setPage(1);
  }, [from, to, source, chapter, locale, tc]);

  return (
    <>
      <PageHeader title={t("reportTitle")} subtitle={t("reportSubtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <DatePicker
            label={t("dateFrom")}
            placeholder="YYYY-MM-DD"
            value={from}
            onChange={setFrom}
          />
          <DatePicker
            label={t("dateTo")}
            placeholder="YYYY-MM-DD"
            value={to}
            onChange={setTo}
          />
          <FieldSelect
            label={t("source")}
            preset="select"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">{tc("all")}</option>
            <option value="episode">{t("sourceEpisode")}</option>
            <option value="visit">{t("sourceVisit")}</option>
            <option value="admission">{t("sourceAdmission")}</option>
          </FieldSelect>
          <FieldSelect
            label={t("chapter")}
            preset="selectWide"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
          >
            <option value="">{t("allChapters")}</option>
            {chapters.map((c) => (
              <option key={c.code} value={c.code}>
                {c.title}
              </option>
            ))}
          </FieldSelect>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void load()}>
            {tc("search")}
          </button>
        </div>
        {msg ? <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("chapter")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("title")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sourceEpisode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sourceVisit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sourceAdmission")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((r) => (
                <tr key={r.code} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{r.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.chapterCode}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.title}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.episode}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.visit}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.admission}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.total}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={7}>
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={items.length}
          loading={busy}
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
      </div>
    </>
  );
}
