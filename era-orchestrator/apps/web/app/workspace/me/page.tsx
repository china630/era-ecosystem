"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../components/workspace/workforce-gate";

const ABSENCE_KINDS = [
  "VACATION",
  "SICK",
  "UNPAID",
  "SOCIAL_LEAVE",
  "EDUCATIONAL_LEAVE",
  "BUSINESS_TRIP",
  "ADMINISTRATIVE",
] as const;

type EmpOpt = {
  employmentId: string;
  organizationId: string;
  organizationName: string;
};

export default function WorkforceMePage() {
  const { ready } = useRequireAuth();
  const { switchOrganization } = useAuth();
  const t = useTranslations("workforceMe");
  const tCommon = useTranslations("common");
  const [ctx, setCtx] = useState<{
    employment: EmpOpt & { globalPersonId: string };
    employments: EmpOpt[];
    profile: {
      fullName?: string | null;
      phoneMasked?: string | null;
      nationality?: string | null;
    };
    unreadAnnouncements: number;
    hrFull?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notEntitled, setNotEntitled] = useState(false);
  const [kind, setKind] = useState<string>("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hourlyPaid, setHourlyPaid] = useState("unpaid");
  const [workDate, setWorkDate] = useState("");
  const [startMinute, setStartMinute] = useState("540");
  const [endMinute, setEndMinute] = useState("600");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceNote, setAdvanceNote] = useState("");
  const [announcements, setAnnouncements] = useState<
    Array<{ id: string; body: string; read: boolean; publishedAt: string }>
  >([]);
  const [payslip, setPayslip] = useState<{
    year: number;
    month: number;
    gross: string;
    net: string;
    lines: Array<{ code: string; amount: string }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await wfFetch("/me");
      if (await isWorkforceGate403(res)) {
        setNotEntitled(true);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCtx(data);
      const empId = data.employment?.employmentId as string;
      if (empId) {
        const a = await wfFetch(`/me/announcements?employmentId=${empId}`);
        if (a.ok) setAnnouncements(await a.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const kindOptions = useMemo(
    () => ABSENCE_KINDS.map((k) => ({ value: k, label: k })),
    [],
  );
  const paidOptions = useMemo(
    () => [
      { value: "unpaid", label: t("hourlyUnpaid") },
      { value: "paid", label: t("hourlyPaid") },
    ],
    [t],
  );

  async function submitAbsence() {
    if (!ctx) return;
    setBusy(true);
    try {
      const res = await wfFetch("/me/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employmentId: ctx.employment.employmentId,
          kind,
          startDate,
          endDate,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitHourly() {
    if (!ctx) return;
    setBusy(true);
    try {
      const res = await wfFetch("/me/hourly-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employmentId: ctx.employment.employmentId,
          workDate,
          startMinute: Number(startMinute),
          endMinute: Number(endMinute),
          paid: hourlyPaid === "paid",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAdvance() {
    if (!ctx) return;
    setBusy(true);
    try {
      const res = await wfFetch("/me/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employmentId: ctx.employment.employmentId,
          amountAzn: Number(advanceAmount),
          note: advanceNote,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAdvanceAmount("");
      setAdvanceNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    if (!ctx) return;
    await wfFetch(`/me/announcements/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employmentId: ctx.employment.employmentId }),
    });
    await load();
  }

  async function loadPayslip() {
    if (!ctx) return;
    const [y, m] = todayBakuYmd().split("-").map((n) => Number(n));
    const month = m === 1 ? 12 : m - 1;
    const year = m === 1 ? y - 1 : y;
    const res = await wfFetch(
      `/me/payslip?employmentId=${ctx.employment.employmentId}&year=${year}&month=${month}`,
    );
    if (res.status === 404) {
      setPayslip(null);
      return;
    }
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setPayslip(await res.json());
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className={`${LIST_PAGE_SHELL_CLASS} max-w-lg mx-auto`}>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ctx ? (
        <>
          {ctx.employments.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {ctx.employments.map((e) => (
                <button
                  key={e.employmentId}
                  type="button"
                  className={
                    e.organizationId === ctx.employment.organizationId
                      ? PRIMARY_BUTTON_CLASS
                      : SECONDARY_BUTTON_CLASS
                  }
                  onClick={() => void switchOrganization(e.organizationId)}
                >
                  {e.organizationName}
                </button>
              ))}
            </div>
          ) : null}
          <section className="mb-6 rounded border p-3 text-sm">
            <div>{ctx.profile.fullName}</div>
            <div>{ctx.profile.phoneMasked}</div>
            <div>
              {t("citizenship")}: {ctx.profile.nationality ?? "—"}
            </div>
            {ctx.unreadAnnouncements > 0 ? (
              <div className="mt-1 font-medium">
                {t("unread", { count: ctx.unreadAnnouncements })}
              </div>
            ) : null}
          </section>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold">{t("fullDay")}</h2>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("absenceKind")}
              value={kind}
              onChange={setKind}
              options={kindOptions}
            />
            <input
              type="date"
              className="w-full rounded border px-2 py-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="w-full rounded border px-2 py-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void submitAbsence()}
            >
              {t("submit")}
            </button>
          </section>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold">{t("hourly")}</h2>
            <input
              type="date"
              className="w-full rounded border px-2 py-1"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="w-full rounded border px-2 py-1"
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
                placeholder="startMinute"
              />
              <input
                className="w-full rounded border px-2 py-1"
                value={endMinute}
                onChange={(e) => setEndMinute(e.target.value)}
                placeholder="endMinute"
              />
            </div>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("hourlyPaidLabel")}
              value={hourlyPaid}
              onChange={setHourlyPaid}
              options={paidOptions}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void submitHourly()}
            >
              {t("submit")}
            </button>
          </section>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold">{t("advance")}</h2>
            <input
              className="w-full rounded border px-2 py-1"
              inputMode="decimal"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              placeholder="AZN"
            />
            <input
              className="w-full rounded border px-2 py-1"
              value={advanceNote}
              onChange={(e) => setAdvanceNote(e.target.value)}
              placeholder={t("note")}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void submitAdvance()}
            >
              {t("submit")}
            </button>
          </section>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold">{t("announcements")}</h2>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAnnouncements")}</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded border p-2 text-sm">
                  <div>{a.body}</div>
                  {!a.read ? (
                    <button
                      type="button"
                      className={`${SECONDARY_BUTTON_CLASS} mt-1`}
                      onClick={() => void markRead(a.id)}
                    >
                      {t("markRead")}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </section>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold">{t("payslip")}</h2>
            {ctx.hrFull ? (
              <>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void loadPayslip()}
                >
                  {t("loadPayslip")}
                </button>
                {payslip ? (
                  <div className="text-sm">
                    <div>
                      {payslip.month}/{payslip.year} — net {payslip.net} AZN
                    </div>
                    <ul>
                      {payslip.lines.map((l, i) => (
                        <li key={`${l.code}-${i}`}>
                          {l.code}: {l.amount}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      ) : (
        <p>{tCommon("loading")}</p>
      )}
    </div>
  );
}
