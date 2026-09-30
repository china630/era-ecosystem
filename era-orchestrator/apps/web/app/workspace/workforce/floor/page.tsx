"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type FloorCard = {
  kind: string;
  employmentId: string;
  globalPersonId: string;
  placeId: string | null;
  punchId: string | null;
  fitnessKind?: string;
  fitnessStatus?: string;
};

type SuspiciousRow = {
  id: string;
  employmentId: string | null;
  placeId: string;
  personRef: string;
  direction: string;
  occurredAt: string;
  reviewReasons: string[];
  allowOutside?: boolean;
};

type FloorResponse = {
  date: string;
  groups: Record<string, FloorCard[]>;
  persons?: Record<string, { displayName?: string | null }>;
  suspiciousCount: number;
  suspicious: SuspiciousRow[];
};

type PunchDetail = {
  punch: {
    id: string;
    personRef: string;
    direction: string;
    occurredAt: string;
    status: string;
    reviewStatus: string;
    reviewReasons: string[];
    placeMismatch: boolean;
    place?: { name?: string; code?: string } | null;
  };
  journal: Array<{
    id: string;
    action: string;
    reason: string;
    createdAt: string;
    actorUserId: string;
  }>;
};

type PlaceOpt = { id: string; name: string; code: string };

const GROUP_ORDER = [
  "FITNESS_ISSUE",
  "PENDING_REQUEST",
  "LATE",
  "SHIFT_STARTED_NO_IN",
  "STILL_INSIDE",
  "OPEN_BREAK",
  "LEFT_EARLY",
  "NOT_ARRIVED",
  "ARRIVED",
] as const;

export default function WorkforceFloorPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceFloor");
  const tRoster = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");
  const [date, setDate] = useState(() => todayBakuYmd());
  const [placeId, setPlaceId] = useState("");
  const [places, setPlaces] = useState<PlaceOpt[]>([]);
  const [data, setData] = useState<FloorResponse | null>(null);
  const [persons, setPersons] = useState<
    Record<string, { displayName?: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [acceptReason, setAcceptReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<PunchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const placeOptions = useMemo(
    () => places.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    [places],
  );

  const nameFor = useCallback(
    (employmentId: string, globalPersonId: string) => {
      const p = persons[globalPersonId];
      return p?.displayName?.trim() || employmentId.slice(0, 8);
    },
    [persons],
  );

  const openPunch = useCallback(
    async (punchId: string) => {
      setDetailLoading(true);
      setError(null);
      const res = await wfFetch(`attendance/punches/${punchId}`);
      setDetailLoading(false);
      if (!res.ok) {
        setError(t("punchLoadError"));
        return;
      }
      const body = (await res.json()) as PunchDetail;
      setDetail({
        punch: {
          ...body.punch,
          occurredAt:
            typeof body.punch.occurredAt === "string"
              ? body.punch.occurredAt
              : String(body.punch.occurredAt),
        },
        journal: (body.journal ?? []).map((j) => ({
          ...j,
          createdAt:
            typeof j.createdAt === "string" ? j.createdAt : String(j.createdAt),
        })),
      });
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ date });
    if (placeId) qs.set("placeId", placeId);
    const [floorRes, placesRes] = await Promise.all([
      wfFetch(`attendance/floor?${qs.toString()}`),
      wfFetch("places?status=ACTIVE"),
    ]);
    if (await isWorkforceGate403(floorRes)) {
      setNotEntitled(true);
      setData(null);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!floorRes.ok) {
      setError(t("loadError"));
      setData(null);
      setLoading(false);
      return;
    }
    const floor = (await floorRes.json()) as FloorResponse;
    setData(floor);
    setPersons(floor.persons ?? {});
    if (placesRes.ok) {
      const pj = await placesRes.json();
      const list = Array.isArray(pj) ? pj : (pj.items ?? []);
      setPlaces(
        list.map((p: PlaceOpt) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
      );
    }
    setLoading(false);
  }, [date, placeId, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function acceptPunch() {
    if (!acceptId || !acceptReason.trim()) return;
    setBusy(true);
    const res = await wfFetch(`attendance/punches/${acceptId}/accept`, {
      method: "POST",
      body: JSON.stringify({ reason: acceptReason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("acceptError"));
      return;
    }
    setAcceptId(null);
    setAcceptReason("");
    setDetail(null);
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm text-[#34495E]">
                {t("date")}
                <input
                  type="date"
                  className="ml-2 rounded border border-[#D5DADF] px-2 py-1"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="min-w-[12rem]">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={tRoster("filterPlace")}
                  value={placeId}
                  onChange={(v) => setPlaceId(String(v))}
                  options={placeOptions}
                  emptyLabel={tRoster("allPlaces")}
                />
              </div>
            </div>
          }
        />
      </div>
      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
      <EraListWorkspace
        filter={null}
        tableShell={false}
        table={
          loading ? (
            <p className="text-sm text-slate-600">{tCommon("loading")}</p>
          ) : (
            <div className="space-y-6 overflow-auto p-1">
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h2 className="mb-2 text-sm font-semibold text-[#34495E]">
                  {t("suspiciousTitle")} ({data?.suspiciousCount ?? 0})
                </h2>
                {(data?.suspicious ?? []).length === 0 ? (
                  <p className="text-xs text-slate-600">{t("suspiciousEmpty")}</p>
                ) : (
                  <ul className="space-y-2">
                    {(data?.suspicious ?? []).map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-3 py-2 text-sm"
                      >
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline"
                          onClick={() => void openPunch(row.id)}
                        >
                          {row.personRef} · {row.direction} ·{" "}
                          {row.reviewReasons.join(", ")}
                          {row.allowOutside
                            ? ` · ${t("allowOutsideHint")}`
                            : ""}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => {
                            setAcceptId(row.id);
                            setAcceptReason("");
                          }}
                        >
                          {t("accept")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {GROUP_ORDER.map((kind) => {
                const list = data?.groups?.[kind] ?? [];
                if (list.length === 0) return null;
                return (
                  <section key={kind}>
                    <h2 className="mb-2 text-sm font-semibold text-[#34495E]">
                      {t(`group.${kind}`)} ({list.length})
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((c) => {
                        const clickable = Boolean(c.punchId);
                        const label = nameFor(c.employmentId, c.globalPersonId);
                        return clickable ? (
                          <button
                            key={`${kind}-${c.employmentId}-${c.punchId}`}
                            type="button"
                            className="rounded-lg border border-[#E5E9EC] bg-white p-3 text-left text-sm hover:border-[#3498DB]"
                            onClick={() => void openPunch(c.punchId!)}
                          >
                            {label}
                          </button>
                        ) : (
                          <div
                            key={`${kind}-${c.employmentId}-${c.fitnessKind ?? "x"}`}
                            className="rounded-lg border border-[#E5E9EC] bg-white p-3 text-sm"
                          >
                            {label}
                            {c.fitnessKind ? (
                              <div className="mt-1 text-xs text-[#7F8C8D]">
                                {t(`fitnessKind.${c.fitnessKind}` as "fitnessKind.HEALTH")}
                                {" · "}
                                {t(`fitnessStatus.${c.fitnessStatus ?? "MISSING"}` as "fitnessStatus.MISSING")}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )
        }
      />
      <ModalShell
        open={Boolean(acceptId)}
        onClose={() => setAcceptId(null)}
        title={t("acceptTitle")}
      >
        <label className="block text-sm">
          {t("acceptReason")}
          <textarea
            className="mt-1 w-full rounded border border-[#D5DADF] p-2"
            rows={3}
            value={acceptReason}
            onChange={(e) => setAcceptReason(e.target.value)}
          />
        </label>
        <ModalFooter
          cancelLabel={tCommon("cancel")}
          onCancel={() => setAcceptId(null)}
          submitLabel={t("accept")}
          submitDisabled={busy || !acceptReason.trim()}
          busy={busy}
          onSubmit={() => void acceptPunch()}
        />
      </ModalShell>
      <ModalShell
        open={detail != null || detailLoading}
        onClose={() => setDetail(null)}
        title={t("punchDetailTitle")}
        closeLabel={tCommon("close")}
      >
        {detailLoading || !detail ? (
          <p className="text-sm text-slate-600">{tCommon("loading")}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              {detail.punch.personRef} · {detail.punch.direction} ·{" "}
              {detail.punch.reviewStatus}
            </p>
            <p className="text-slate-600">
              {detail.punch.occurredAt}
              {detail.punch.place?.name
                ? ` · ${detail.punch.place.name}`
                : ""}
            </p>
            {detail.punch.reviewReasons?.length ? (
              <p>{detail.punch.reviewReasons.join(", ")}</p>
            ) : null}
            <div>
              <h3 className="mb-1 font-semibold">{t("journalTitle")}</h3>
              {detail.journal.length === 0 ? (
                <p className="text-xs text-slate-600">{t("journalEmpty")}</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {detail.journal.map((j) => (
                    <li key={j.id}>
                      {j.action}: {j.reason} · {j.createdAt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {detail.punch.reviewStatus === "SUSPICIOUS" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setAcceptId(detail.punch.id);
                  setAcceptReason("");
                }}
              >
                {t("accept")}
              </button>
            ) : null}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
