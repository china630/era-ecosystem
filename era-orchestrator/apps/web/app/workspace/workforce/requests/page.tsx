"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type Queue = {
  absences: Array<{
    id: string;
    kind: string;
    startDate: string;
    endDate: string;
    submittedByUserId?: string | null;
    employment: { id: string; globalPersonId: string };
  }>;
  hourly: Array<{
    id: string;
    workDate: string;
    startMinute: number;
    endMinute: number;
    paid: boolean;
    submittedByUserId?: string | null;
    employment: { id: string; globalPersonId: string };
  }>;
  advances: Array<{
    id: string;
    amountAzn: string | number;
    note: string;
    exceedsLimit?: boolean;
    plannedPayDate?: string | null;
    submittedByUserId?: string | null;
    employment: { id: string; globalPersonId: string };
  }>;
  persons?: Record<string, { displayName?: string | null }>;
  approval?: Record<
    string,
    { configured: boolean; stepOrder: number; stepKind: string | null; orgUnitName: string | null }
  >;
  history?: Array<{
    id: string;
    entityType: string;
    entityId: string;
    stepOrder: number;
    outcome: string;
    orgUnitName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  submitters?: Record<string, { label: string; hr: boolean }>;
};

export default function WorkforceRequestsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRequests");
  const tCommon = useTranslations("common");
  const tAbsence = useTranslations("workforceAbsences");
  const [data, setData] = useState<Queue | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [proxyOn, setProxyOn] = useState(false);
  const [managerOn, setManagerOn] = useState(false);
  const [mgrEmp, setMgrEmp] = useState("");
  const [mgrKind, setMgrKind] = useState("FULL_DAY");
  const [mgrAbsence, setMgrAbsence] = useState("VACATION");
  const [mgrStart, setMgrStart] = useState("");
  const [mgrEnd, setMgrEnd] = useState("");
  const [mgrDate, setMgrDate] = useState("");
  const [mgrFromMin, setMgrFromMin] = useState("540");
  const [mgrToMin, setMgrToMin] = useState("720");
  const [mgrPaid, setMgrPaid] = useState(true);
  const [mgrAmount, setMgrAmount] = useState("");
  const [mgrNote, setMgrNote] = useState("");
  const [proxyEmp, setProxyEmp] = useState("");
  const [proxyAmount, setProxyAmount] = useState("");
  const [proxyNote, setProxyNote] = useState("");
  const [proxyPeople, setProxyPeople] = useState<Array<{ value: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await wfFetch("/requests");
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      return;
    }
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setData(await res.json());
    const settingsRes = await wfFetch("/hr-settings");
    if (settingsRes.ok) {
      const body = (await settingsRes.json()) as {
        settings?: { advanceAllowHrProxy?: boolean; allowManagerSubmit?: boolean };
      };
      const allowed = Boolean(body.settings?.advanceAllowHrProxy);
      const manager = Boolean(body.settings?.allowManagerSubmit);
      setProxyOn(allowed);
      setManagerOn(manager);
      if (allowed || manager) {
        const empRes = await wfFetch("/employments?status=ACTIVE");
        if (empRes.ok) {
          const roster = (await empRes.json()) as {
            items?: Array<{ id: string; globalPersonId: string }>;
            persons?: Record<string, { displayName?: string | null }>;
          };
          setProxyPeople(
            (roster.items ?? []).map((row) => ({
              value: row.id,
              label: roster.persons?.[row.globalPersonId]?.displayName || row.id.slice(0, 8),
            })),
          );
        }
      }
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function act(path: string, reason?: string) {
    setBusy(true);
    try {
      const res = await wfFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const res = await wfFetch("/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: announce }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAnnounce("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const name = (gid: string) =>
    data?.persons?.[gid]?.displayName ?? gid.slice(0, 8);
  const entered = (userId?: string | null) => {
    if (!userId) return t("submittedByHr");
    const row = data?.submitters?.[userId];
    if (!row || row.hr) return t("submittedByHr");
    return row.label || t("submittedByEmployee");
  };
  const chain = (id: string) =>
    [...(data?.history ?? [])]
      .filter((row) => row.entityId === id)
      .reverse()
      .map((row) =>
        [row.outcome, row.orgUnitName].filter(Boolean).join(" · "),
      )
      .join(" → ");
  const stepLabel = (id: string) => {
    const step = data?.approval?.[id];
    if (!step?.configured) return null;
    const unit = step.orgUnitName ? ` · ${step.orgUnitName}` : "";
    return `${t("step")} ${step.stepOrder + 1}${unit}`;
  };

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      <label className="mb-3 block max-w-md text-[13px] font-medium text-[#34495E]">
        {t("rejectReason")}
        <input
          className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </label>

      <EraListWorkspace
        tableShell={false}
        table={
          <div className="space-y-2 p-1">
        <h2 className="font-semibold mb-2">{t("absences")}</h2>
        {(data?.absences ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
            <span>{name(a.employment.globalPersonId)}</span>
            <span>{a.kind}</span>
            <span>
              {String(a.startDate).slice(0, 10)} – {String(a.endDate).slice(0, 10)}
            </span>
            {stepLabel(a.id) ? <span>{stepLabel(a.id)}</span> : null}
            <span className="text-[#7F8C8D]">{entered(a.submittedByUserId)}</span>
            {chain(a.id) ? <span className="text-[11px] text-[#7F8C8D]">{chain(a.id)}</span> : null}
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/absence/${a.id}/approve`)}
            >
              {t("approve")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/absence/${a.id}/reject`, rejectReason)}
            >
              {t("reject")}
            </button>
          </div>
        ))}

        <h2 className="font-semibold mt-6 mb-2">{t("hourly")}</h2>
        {(data?.hourly ?? []).map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
            <span>{name(h.employment.globalPersonId)}</span>
            <span>{String(h.workDate).slice(0, 10)}</span>
            <span>
              {h.startMinute}–{h.endMinute}
            </span>
            <span>{h.paid ? t("paid") : t("unpaid")}</span>
            {stepLabel(h.id) ? <span>{stepLabel(h.id)}</span> : null}
            <span className="text-[#7F8C8D]">{entered(h.submittedByUserId)}</span>
            {chain(h.id) ? <span className="text-[11px] text-[#7F8C8D]">{chain(h.id)}</span> : null}
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/hourly/${h.id}/approve`)}
            >
              {t("approve")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/hourly/${h.id}/reject`, rejectReason)}
            >
              {t("reject")}
            </button>
          </div>
        ))}

        <h2 className="font-semibold mt-6 mb-2">{t("advances")}</h2>
        {(data?.advances ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
            <span>{name(a.employment.globalPersonId)}</span>
            <span>{Number(a.amountAzn).toFixed(2)} AZN</span>
            <span>{a.note}</span>
            {stepLabel(a.id) ? <span>{stepLabel(a.id)}</span> : null}
            <span className="text-[#7F8C8D]">{entered(a.submittedByUserId)}</span>
            {chain(a.id) ? <span className="text-[11px] text-[#7F8C8D]">{chain(a.id)}</span> : null}
            {a.exceedsLimit ? <span>{t("exceedsLimit")}</span> : null}
            {a.plannedPayDate ? (
              <span>{t("plannedPay", { date: String(a.plannedPayDate).slice(0, 10) })}</span>
            ) : null}
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/advance/${a.id}/approve`)}
            >
              {t("approve")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void act(`/requests/advance/${a.id}/reject`, rejectReason)}
            >
              {t("reject")}
            </button>
          </div>
        ))}
          </div>
        }
      />

      {(data?.history?.length ?? 0) > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">{t("history")}</h2>
          <ul className="space-y-1 text-sm text-[#34495E]">
            {(data?.history ?? []).map((row) => (
              <li key={row.id}>
                {row.entityType} · {row.outcome}
                {row.orgUnitName ? ` · ${row.orgUnitName}` : ""}
                {" · "}
                {String(row.createdAt).slice(0, 16).replace("T", " ")}
                {row.reason ? ` · ${row.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {proxyOn ? (
        <section className="mt-6 max-w-lg space-y-2">
          <h2 className="font-semibold">{t("proxyTitle")}</h2>
          <CatalogField
            kind="ENTITY_REF"
            label={t("proxyEmployee")}
            value={proxyEmp}
            onChange={(next) => setProxyEmp(String(next))}
            options={proxyPeople}
            emptyLabel={t("proxyEmployee")}
          />
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("proxyAmount")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
              inputMode="decimal"
              value={proxyAmount}
              onChange={(e) => setProxyAmount(e.target.value)}
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("proxyNote")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
              value={proxyNote}
              onChange={(e) => setProxyNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !proxyEmp || !(Number(proxyAmount) > 0)}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  const res = await wfFetch("/requests/advance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      employmentId: proxyEmp,
                      amountAzn: Number(proxyAmount),
                      note: proxyNote,
                    }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  setProxyAmount("");
                  setProxyNote("");
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {t("proxySubmit")}
          </button>
        </section>
      ) : null}

      {managerOn ? (
        <section className="mt-6 max-w-lg space-y-2">
          <h2 className="font-semibold">{t("managerTitle")}</h2>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("managerKind")}
            value={mgrKind}
            onChange={(next) => setMgrKind(String(next))}
            options={[
              { value: "FULL_DAY", label: t("onBehalfKind.FULL_DAY") },
              { value: "HOURLY", label: t("onBehalfKind.HOURLY") },
              { value: "ADVANCE", label: t("onBehalfKind.ADVANCE") },
            ]}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("proxyEmployee")}
            value={mgrEmp}
            onChange={(next) => setMgrEmp(String(next))}
            options={proxyPeople}
            emptyLabel={t("proxyEmployee")}
          />
          {mgrKind === "FULL_DAY" ? (
            <>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("managerAbsence")}
                value={mgrAbsence}
                onChange={(next) => setMgrAbsence(String(next))}
                options={[
                  "VACATION",
                  "SICK",
                  "UNPAID",
                  "SOCIAL_LEAVE",
                  "EDUCATIONAL_LEAVE",
                  "BUSINESS_TRIP",
                  "ADMINISTRATIVE",
                ].map((value) => ({
                  value,
                  label: tAbsence(`kind.${value}` as "kind.VACATION"),
                }))}
              />
              <DatePicker
                label={t("managerStart")}
                value={mgrStart}
                onChange={setMgrStart}
                placeholder={tCommon("datePlaceholder")}
              />
              <DatePicker
                label={t("managerEnd")}
                value={mgrEnd}
                onChange={setMgrEnd}
                placeholder={tCommon("datePlaceholder")}
              />
            </>
          ) : null}
          {mgrKind === "HOURLY" ? (
            <>
              <DatePicker
                label={t("managerDate")}
                value={mgrDate}
                onChange={setMgrDate}
                placeholder={tCommon("datePlaceholder")}
              />
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("managerFrom")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                  inputMode="numeric"
                  value={mgrFromMin}
                  onChange={(e) => setMgrFromMin(e.target.value)}
                />
              </label>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("managerTo")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                  inputMode="numeric"
                  value={mgrToMin}
                  onChange={(e) => setMgrToMin(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
                <input
                  type="checkbox"
                  checked={mgrPaid}
                  onChange={(e) => setMgrPaid(e.target.checked)}
                />
                {t("paid")}
              </label>
            </>
          ) : null}
          {mgrKind === "ADVANCE" ? (
            <>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("proxyAmount")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                  inputMode="decimal"
                  value={mgrAmount}
                  onChange={(e) => setMgrAmount(e.target.value)}
                />
              </label>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("proxyNote")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5"
                  value={mgrNote}
                  onChange={(e) => setMgrNote(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={
              busy ||
              !mgrEmp ||
              (mgrKind === "FULL_DAY" && (!mgrStart || !mgrEnd)) ||
              (mgrKind === "HOURLY" && (!mgrDate || !(Number(mgrToMin) > Number(mgrFromMin)))) ||
              (mgrKind === "ADVANCE" && !(Number(mgrAmount) > 0))
            }
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  const body =
                    mgrKind === "HOURLY"
                      ? {
                          kind: "HOURLY",
                          employmentId: mgrEmp,
                          workDate: mgrDate,
                          startMinute: Number(mgrFromMin),
                          endMinute: Number(mgrToMin),
                          paid: mgrPaid,
                          note: mgrNote,
                        }
                      : mgrKind === "ADVANCE"
                        ? {
                            kind: "ADVANCE",
                            employmentId: mgrEmp,
                            amountAzn: Number(mgrAmount),
                            note: mgrNote,
                          }
                        : {
                            kind: "FULL_DAY",
                            employmentId: mgrEmp,
                            absenceKind: mgrAbsence,
                            startDate: mgrStart,
                            endDate: mgrEnd,
                            note: mgrNote,
                          };
                  const res = await wfFetch("/requests/on-behalf", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  setMgrStart("");
                  setMgrEnd("");
                  setMgrAmount("");
                  setMgrNote("");
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {t("managerSubmit")}
          </button>
        </section>
      ) : null}

      <section className="mt-8 space-y-2 max-w-lg">
        <h2 className="font-semibold">{t("announce")}</h2>
        <textarea
          className="w-full rounded border p-2 text-sm"
          rows={3}
          value={announce}
          onChange={(e) => setAnnounce(e.target.value)}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !announce.trim()}
          onClick={() => void publish()}
        >
          {t("publish")}
        </button>
      </section>
    </div>
  );
}
