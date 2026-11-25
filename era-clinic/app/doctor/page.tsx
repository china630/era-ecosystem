"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, FlaskConical, FileWarning, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay, bakuTimeLabel, todayBakuYmd } from "@/lib/baku-day";

type DoctorDayEntry = {
  appointmentId: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: string;
  mode?: string;
  videoRoomUrl?: string | null;
  practitioner: { id: string; code: string; fullName: string };
  patient: {
    id: string;
    refCode: string;
    fullName: string;
    sex: string | null;
    birthDate: string | null;
    bloodGroup: string;
  };
  visitId: string | null;
  visitStatus: string | null;
  queueTicket: {
    id: string;
    queueNumber: number;
    status: string;
    desk: string | null;
  } | null;
  flags: {
    hasUnsignedProtocol: boolean;
    hasReadyLabs: boolean;
    hasCriticalLab: boolean;
  };
};

type DoctorDayBoard = {
  date: string;
  scopeMode: "ALL" | "ASSIGNED";
  practitionerId: string | null;
  entries: DoctorDayEntry[];
};

type CardSummary = {
  resultsPreview?: Array<{ title?: string; subtitle?: string }>;
  examNotesPreview?: Array<{ at?: string; title?: string; href?: string }>;
};

type ContraindicationRow = { bodyPart: string; note?: string | null };

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "border-l-[#2980B9]",
  CHECKED_IN: "border-l-[#27AE60]",
  IN_PROGRESS: "border-l-[#F39C12]",
  COMPLETED: "border-l-slate-400",
};

const POLL_MS = 30_000;

export default function DoctorPage() {
  const t = useTranslations("doctor");
  const locale = useLocale();
  const [dateYmd, setDateYmd] = useState(todayBakuYmd());
  const [board, setBoard] = useState<DoctorDayBoard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardSummary, setCardSummary] = useState<CardSummary | null>(null);
  const [contraindications, setContraindications] = useState<ContraindicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const selected = useMemo(
    () => board?.entries.find((e) => e.appointmentId === selectedId) ?? null,
    [board, selectedId],
  );

  const loadBoard = useCallback(async () => {
    const res = await fetch(`/api/doctor/day?date=${encodeURIComponent(dateYmd)}`);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), t("loadFailed"));
      return;
    }
    const data = (await res.json()) as DoctorDayBoard;
    setBoard(data);
    setSelectedId((prev) => {
      if (prev && data.entries.some((e) => e.appointmentId === prev)) return prev;
      return data.entries[0]?.appointmentId ?? null;
    });
    setLoading(false);
  }, [dateYmd, t]);

  useEffect(() => {
    setLoading(true);
    void loadBoard();
    const timer = window.setInterval(() => void loadBoard(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadBoard]);

  useEffect(() => {
    if (!selected?.patient.id) {
      setCardSummary(null);
      setContraindications([]);
      return;
    }
    void Promise.all([
      fetch(`/api/patients/${selected.patient.id}/card-summary`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/patients/${selected.patient.id}/contraindications`).then((r) =>
        r.ok ? r.json() : [],
      ),
    ]).then(([summary, contra]) => {
      setCardSummary(summary as CardSummary | null);
      setContraindications(Array.isArray(contra) ? (contra as ContraindicationRow[]) : []);
    });
  }, [selected?.patient.id]);

  async function callPatient() {
    if (!selected?.queueTicket?.id) return;
    const res = await fetch(`/api/queue/tickets/${selected.queueTicket.id}/call`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desk: "DOCTOR" }),
    });
    if (res.ok) {
      showSuccess(t("called"));
      await loadBoard();
      return;
    }
    showApiError(await res.json().catch(() => ({})), t("callFailed"));
  }

  async function enableVideoVisit() {
    if (!selected) return;
    const res = await fetch(`/api/appointments/${selected.appointmentId}/telehealth`, {
      method: "POST",
    });
    if (res.ok) {
      showSuccess(t("videoEnabled"));
      await loadBoard();
      return;
    }
    showApiError(await res.json().catch(() => ({})), t("videoFailed"));
  }

  async function startVisit() {
    if (!selected) return;
    const res = await fetch(`/api/appointments/${selected.appointmentId}/check-in`, {
      method: "POST",
    });
    if (res.ok) {
      showSuccess(t("checkInDone"));
      await loadBoard();
      return;
    }
    showApiError(await res.json().catch(() => ({})), t("checkInFailed"));
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <DatePicker
          label={t("filterDate")}
          value={dateYmd}
          locale={locale}
          onChange={(v) => setDateYmd(v || todayBakuYmd())}
        />
        <span className={`text-sm ${TEXT_MUTED_CLASS}`}>
          {t("entryCount", { count: board?.entries.length ?? 0 })}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={`${CARD_CONTAINER_CLASS} max-h-[70vh] overflow-y-auto p-3`}>
          <h2 className="mb-2 text-sm font-semibold">{t("timeline")}</h2>
          <ul className="space-y-2">
            {board?.entries.map((entry) => {
              const active = entry.appointmentId === selectedId;
              return (
                <li key={entry.appointmentId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.appointmentId)}
                    className={`w-full rounded border border-l-4 p-2 text-left text-sm transition ${
                      STATUS_CLASS[entry.status] ?? "border-l-slate-300"
                    } ${active ? "bg-[#2980B9]/5 ring-1 ring-[#2980B9]/40" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium tabular-nums">
                        {bakuTimeLabel(entry.scheduledAt)}
                      </span>
                      <span className={`text-xs uppercase ${TEXT_MUTED_CLASS}`}>
                        {t(`status.${entry.status}`, { defaultValue: entry.status })}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{entry.patient.fullName}</p>
                    <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{entry.patient.refCode}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {entry.flags.hasUnsignedProtocol ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <FileWarning className="h-3.5 w-3.5" aria-hidden />
                          {t("flagUnsigned")}
                        </span>
                      ) : null}
                      {entry.flags.hasReadyLabs ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            entry.flags.hasCriticalLab ? "text-red-700" : "text-[#2980B9]"
                          }`}
                        >
                          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                          {entry.flags.hasCriticalLab ? t("flagCriticalLab") : t("flagReadyLabs")}
                        </span>
                      ) : null}
                      {entry.queueTicket ? (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          #{entry.queueTicket.queueNumber}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
            {!loading && (board?.entries.length ?? 0) === 0 ? (
              <li className={`py-6 text-center text-sm ${TEXT_MUTED_CLASS}`}>{t("empty")}</li>
            ) : null}
          </ul>
        </div>

        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h2 className="mb-3 text-sm font-semibold">{t("patientPanel")}</h2>
          {!selected ? (
            <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("selectPatient")}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <RouteSummary entry={selected} t={t} />
              <div className="flex flex-wrap gap-2">
                {selected.queueTicket ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void callPatient()}
                  >
                    {t("call")}
                  </button>
                ) : null}
                {selected.status === "SCHEDULED" ? (
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => void startVisit()}
                  >
                    {t("startVisit")}
                  </button>
                ) : null}
                {selected.visitId ? (
                  <Link href={`/visits/${selected.visitId}`} className={SECONDARY_BUTTON_CLASS}>
                    {t("openVisit")}
                  </Link>
                ) : null}
                {selected.status !== "COMPLETED" && selected.status !== "CANCELLED" ? (
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void enableVideoVisit()}>
                    {t("enableVideo")}
                  </button>
                ) : null}
                {selected.mode === "VIDEO" && selected.videoRoomUrl ? (
                  <Link
                    href={`/telehealth?room=${encodeURIComponent(selected.videoRoomUrl)}`}
                    className={PRIMARY_BUTTON_CLASS}
                  >
                    {t("joinVideo")}
                  </Link>
                ) : null}
              </div>

              {contraindications.length ? (
                <section>
                  <h3 className="mb-1 flex items-center gap-1 font-medium text-amber-800">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    {t("contraindications")}
                  </h3>
                  <ul className="list-disc pl-5 text-amber-900">
                    {contraindications.slice(0, 5).map((row, i) => (
                      <li key={i}>
                        {row.bodyPart}
                        {row.note ? ` — ${row.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {cardSummary?.resultsPreview?.length ? (
                <section>
                  <h3 className="mb-1 font-medium">{t("recentLabs")}</h3>
                  <ul className="space-y-1">
                    {cardSummary.resultsPreview.slice(0, 5).map((row, i) => (
                      <li
                        key={i}
                        className={
                          selected.flags.hasCriticalLab ? "font-medium text-red-700" : undefined
                        }
                      >
                        {row.title ?? "—"}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {cardSummary?.examNotesPreview?.length ? (
                <section>
                  <h3 className="mb-1 font-medium">{t("recentVisits")}</h3>
                  <ul className={`space-y-1 ${TEXT_MUTED_CLASS}`}>
                    {cardSummary.examNotesPreview.slice(0, 5).map((row) => (
                      <li key={row.href ?? row.at}>
                        {row.at ? bakuDateTimeDisplay(row.at) : "—"} — {row.title ?? "—"}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RouteSummary({
  entry,
  t,
}: {
  entry: DoctorDayEntry;
  t: ReturnType<typeof useTranslations<"doctor">>;
}) {
  return (
    <dl className="grid gap-1 sm:grid-cols-2">
      <div>
        <dt className={TEXT_MUTED_CLASS}>{t("patientName")}</dt>
        <dd className="font-medium">{entry.patient.fullName}</dd>
      </div>
      <div>
        <dt className={TEXT_MUTED_CLASS}>{t("scheduledAt")}</dt>
        <dd>{bakuDateTimeDisplay(entry.scheduledAt)}</dd>
      </div>
      <div>
        <dt className={TEXT_MUTED_CLASS}>{t("practitioner")}</dt>
        <dd>{entry.practitioner.fullName}</dd>
      </div>
      <div>
        <dt className={TEXT_MUTED_CLASS}>{t("bloodGroup")}</dt>
        <dd>{entry.patient.bloodGroup}</dd>
      </div>
      {entry.patient.birthDate ? (
        <div>
          <dt className={TEXT_MUTED_CLASS}>{t("birthDate")}</dt>
          <dd>{entry.patient.birthDate}</dd>
        </div>
      ) : null}
      {entry.patient.sex ? (
        <div>
          <dt className={TEXT_MUTED_CLASS}>{t("sex")}</dt>
          <dd>{entry.patient.sex}</dd>
        </div>
      ) : null}
    </dl>
  );
}