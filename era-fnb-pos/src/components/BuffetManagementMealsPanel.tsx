"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { todayBakuYmd } from "@era/satellite-kit/time";
import {
  Field,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";

type MealRow = {
  id: string;
  serviceDate: string;
  meal: string;
  actorLabel: string;
  signedAt: string;
};

type Eater = {
  id: string;
  displayLabel: string;
  included: boolean;
  source: string;
};

type Props = {
  outletId: string;
  fromDate: string;
  toDate: string;
  onChanged?: () => void;
  /** Lift primary CTAs into BuffetPageChrome (WP6). */
  onChromeReady?: (api: {
    openRoster: () => void;
    openSignToday: () => void;
  }) => void;
  hideInlineChrome?: boolean;
};

function eachYmd(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    const [y, m, d] = cur.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    cur = dt.toISOString().slice(0, 10);
  }
  return out;
}

export default function BuffetManagementMealsPanel({
  outletId,
  fromDate,
  toDate,
  onChanged,
  onChromeReady,
  hideInlineChrome = false,
}: Props) {
  const t = useTranslations("admin.buffet");
  const tc = useTranslations("common");
  const today = todayBakuYmd();
  const [rows, setRows] = useState<MealRow[]>([]);
  const [eaters, setEaters] = useState<Eater[]>([]);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailMeal, setDetailMeal] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [manualLabel, setManualLabel] = useState("");

  const dates = useMemo(() => eachYmd(fromDate, toDate), [fromDate, toDate]);

  const loadMeals = useCallback(() => {
    if (!outletId) {
      setRows([]);
      return;
    }
    const q = new URLSearchParams({
      outletId,
      from: fromDate,
      to: toDate,
    });
    return fetch(`/api/admin/buffet/management-meals?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setRows(Array.isArray(d?.meals) ? (d.meals as MealRow[]) : []);
      })
      .catch(() => undefined);
  }, [outletId, fromDate, toDate]);

  const loadEaters = useCallback(() => {
    const q = outletId ? `?outletId=${encodeURIComponent(outletId)}` : "";
    return fetch(`/api/admin/buffet/management-eaters${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setEaters(Array.isArray(d?.eaters) ? (d.eaters as Eater[]) : []);
      })
      .catch(() => undefined);
  }, [outletId]);

  useEffect(() => {
    void loadMeals();
    void loadEaters();
  }, [loadMeals, loadEaters]);

  const countFor = (date: string, meal: string) =>
    rows.filter((r) => r.serviceDate.slice(0, 10) === date && r.meal === meal).length;

  const detailRows = rows.filter(
    (r) =>
      detailDate &&
      detailMeal &&
      r.serviceDate.slice(0, 10) === detailDate &&
      r.meal === detailMeal,
  );

  const dayLocked = (date: string) => date < today;

  async function syncHr() {
    const res = await fetch("/api/admin/buffet/management-eaters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", outletId: outletId || null }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Prefer locale toast — API `error` is English and would win in showApiError.
      showApiError(
        data?.code === "ORCH_UNAVAILABLE" ? null : data,
        data?.code === "ORCH_UNAVAILABLE"
          ? t("eatersSyncUnavailable")
          : t("eatersSyncFailed"),
      );
      return;
    }
    showSuccess(t("eatersSynced", { count: data?.total ?? 0 }));
    await loadEaters();
  }

  async function toggleEater(id: string, included: boolean) {
    const res = await fetch(`/api/admin/buffet/management-eaters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ included }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("eatersPatchFailed"));
      return;
    }
    setEaters(Array.isArray(data?.eaters) ? data.eaters : eaters);
  }

  async function addManual() {
    const res = await fetch("/api/admin/buffet/management-eaters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "manual",
        displayLabel: manualLabel,
        outletId: outletId || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("eatersCreateFailed"));
      return;
    }
    setManualLabel("");
    setEaters(Array.isArray(data?.eaters) ? data.eaters : []);
    showSuccess(t("eatersCreated"));
  }

  function openSignToday() {
    const included = eaters.filter((e) => e.included);
    const next: Record<string, boolean> = {};
    for (const e of included) {
      for (const meal of BUFFET_MEALS) {
        const already = rows.some(
          (r) =>
            r.serviceDate.slice(0, 10) === today &&
            r.meal === meal &&
            r.actorLabel === e.displayLabel,
        );
        next[`${e.id}|${meal}`] = already;
      }
    }
    setChecks(next);
    setSignOpen(true);
  }

  useEffect(() => {
    onChromeReady?.({
      openRoster: () => setRosterOpen(true),
      openSignToday,
    });
  }, [onChromeReady, eaters, rows, today]);

  async function saveSignToday() {
    const included = eaters.filter((e) => e.included);
    for (const e of included) {
      for (const meal of BUFFET_MEALS) {
        const key = `${e.id}|${meal}`;
        const want = checks[key] === true;
        const existing = rows.find(
          (r) =>
            r.serviceDate.slice(0, 10) === today &&
            r.meal === meal &&
            r.actorLabel === e.displayLabel,
        );
        if (want && !existing) {
          const res = await fetch("/api/admin/buffet/management-meals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              outletId,
              serviceDate: today,
              meal,
              actorLabel: e.displayLabel,
              eaterId: e.id,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            showApiError(data, t("signFailed"));
            return;
          }
        }
        if (!want && existing) {
          const res = await fetch(`/api/admin/buffet/management-meals/${existing.id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            showApiError(data, t("signDeleteFailed"));
            return;
          }
        }
      }
    }
    setSignOpen(false);
    showSuccess(t("signed"));
    await loadMeals();
    onChanged?.();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/buffet/management-meals/${id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("signDeleteFailed"));
      return;
    }
    showSuccess(t("signDeleted"));
    await loadMeals();
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      {!hideInlineChrome ? (
        <div className={`${CARD_CLASS} space-y-3 p-4`}>
          <p className="text-sm text-[#7F8C8D]">{t("managementHint")}</p>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={!outletId}
              onClick={() => setRosterOpen(true)}
            >
              {t("eatersRoster")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!outletId}
              onClick={() => openSignToday()}
            >
              {t("signManagementToday")}
            </button>
          </div>
        </div>
      ) : (
        <p className="m-0 text-sm text-[#7F8C8D]">{t("managementHint")}</p>
      )}

      <div className={`${CARD_CLASS} overflow-auto`}>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
            <tr>
              <th className="px-3 py-2 font-medium">{t("colDate")}</th>
              {BUFFET_MEALS.map((m) => (
                <th key={m} className="px-3 py-2 font-medium">
                  {t(`meal.${m}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {dates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#7F8C8D]">
                  {t("managementEmpty")}
                </td>
              </tr>
            ) : (
              dates.map((date) => (
                <tr key={date} className={dayLocked(date) ? "bg-[#F8FAFC]" : undefined}>
                  <td className="px-3 py-2 tabular-nums">
                    {date}
                    {dayLocked(date) ? (
                      <span className="ml-2 text-xs text-[#95A5A6]">{t("dayLocked")}</span>
                    ) : null}
                  </td>
                  {BUFFET_MEALS.map((meal) => {
                    const n = countFor(date, meal);
                    return (
                      <td key={meal} className="px-3 py-2">
                        <button
                          type="button"
                          className="tabular-nums text-[#2980B9] underline"
                          onClick={() => {
                            setDetailDate(date);
                            setDetailMeal(meal);
                          }}
                        >
                          {n}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalShell
        open={Boolean(detailDate && detailMeal)}
        title={
          detailDate && detailMeal
            ? `${detailDate} · ${t(`meal.${detailMeal}`)}`
            : t("managementTitle")
        }
        onClose={() => {
          setDetailDate(null);
          setDetailMeal(null);
        }}
      >
        <ul className="space-y-2 text-sm">
          {detailRows.length === 0 ? (
            <li className="text-[#7F8C8D]">{t("managementEmpty")}</li>
          ) : (
            detailRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span>{row.actorLabel}</span>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void remove(row.id)}
                >
                  {t("signDelete")}
                </button>
              </li>
            ))
          )}
        </ul>
      </ModalShell>

      <ModalShell
        open={signOpen}
        title={t("signManagementToday")}
        onClose={() => setSignOpen(false)}
      >
        <p className="m-0 mb-3 text-sm text-[#7F8C8D]">{today}</p>
        <div className="overflow-auto max-h-[50vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#7F8C8D]">
                <th className="py-1 text-left">{t("colActor")}</th>
                {BUFFET_MEALS.map((m) => (
                  <th key={m} className="py-1 text-center">
                    {t(`meal.${m}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eaters
                .filter((e) => e.included)
                .map((e) => (
                  <tr key={e.id}>
                    <td className="py-1 pr-2">{e.displayLabel}</td>
                    {BUFFET_MEALS.map((meal) => {
                      const key = `${e.id}|${meal}`;
                      return (
                        <td key={meal} className="py-1 text-center">
                          <input
                            type="checkbox"
                            checked={checks[key] === true}
                            onChange={(ev) =>
                              setChecks((c) => ({ ...c, [key]: ev.target.checked }))
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ModalFooter
          onCancel={() => setSignOpen(false)}
          onSubmit={() => void saveSignToday()}
          cancelLabel={tc("cancel")}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <ModalShell
        open={rosterOpen}
        title={t("eatersRoster")}
        onClose={() => setRosterOpen(false)}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void syncHr()}>
            {t("eatersSyncHr")}
          </button>
        </div>
        {eaters.length === 0 ? (
          <p className="mb-4 text-sm text-[#E67E22]">{t("eatersEmptyHonesty")}</p>
        ) : null}
        <ul className="mb-4 max-h-[40vh] space-y-2 overflow-auto text-sm">
          {eaters.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={e.included}
                  onChange={(ev) => void toggleEater(e.id, ev.target.checked)}
                />
                <span>
                  {e.displayLabel}{" "}
                  <span className="text-xs text-[#95A5A6]">{e.source}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <Field
            label={t("eatersManualLabel")}
            preset="shortText"
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
          />
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void addManual()}>
            {t("eatersAddManual")}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
