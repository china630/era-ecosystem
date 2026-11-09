"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DatePicker,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";
import type { BonusSchedule } from "@/domain/reports/bonus-schedule";
import { BONUS_CATEGORIES } from "@/domain/reports/bonus-schedule";

type Person = { id: string; fullName: string; staffKind: string };
type Month = {
  lines: Array<{ practitionerId: string; name: string; turnover: number; bonus: number }>;
  fundTurnover: number;
  fundBonus: number;
  total: number;
  netPercent: number;
};

export default function BonusReportPage() {
  const t = useTranslations("bonusReport");
  const tc = useTranslations("nav");
  const [from, setFrom] = useState(addBakuDays(todayBakuYmd(), -30));
  const [to, setTo] = useState(todayBakuYmd());
  const [schedule, setSchedule] = useState<BonusSchedule | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [month, setMonth] = useState<Month | null>(null);

  async function load(nextFrom = from, nextTo = to) {
    const res = await fetch(`/api/reports/bonus?from=${nextFrom}&to=${nextTo}`);
    const body = await res.json();
    if (!res.ok) {
      showApiError(body, t("save"));
      return;
    }
    const data = body.data ?? body;
    setSchedule(data.schedule);
    setPeople(data.people ?? []);
    setMonth(data.month);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function save() {
    if (!schedule) return;
    const res = await fetch("/api/reports/bonus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    const body = await res.json();
    if (!res.ok) {
      showApiError(body, t("save"));
      return;
    }
    showSuccess(t("saved"));
    await load();
  }

  if (!schedule) return null;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={tc("bonusReport")} />
      <div className="mb-4 flex flex-wrap gap-3">
        <DatePicker label={t("from")} value={from} onChange={setFrom} placeholder="dd.mm.yyyy" />
        <DatePicker label={t("to")} value={to} onChange={setTo} placeholder="dd.mm.yyyy" />
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          {t("vat")}
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            type="number"
            value={schedule.vatPercent}
            onChange={(e) => setSchedule({ ...schedule, vatPercent: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          {t("profit")}
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            type="number"
            value={schedule.profitTaxPercent}
            onChange={(e) => setSchedule({ ...schedule, profitTaxPercent: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          {t("fund")}
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            type="number"
            value={schedule.fundPercent}
            onChange={(e) => setSchedule({ ...schedule, fundPercent: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          {t("labDoctor")}
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={schedule.labPractitionerId ?? ""}
            onChange={(e) => setSchedule({ ...schedule, labPractitionerId: e.target.value || null })}
          >
            <option value="">{t("none")}</option>
            {people.filter((p) => p.staffKind !== "MASSAGE").map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t("usDoctor")}
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={schedule.usPractitionerId ?? ""}
            onChange={(e) => setSchedule({ ...schedule, usPractitionerId: e.target.value || null })}
          >
            <option value="">{t("none")}</option>
            {people.filter((p) => p.staffKind !== "MASSAGE").map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mb-4 overflow-auto text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">{t("coef")}</th>
              {people.map((p) => (
                <th key={p.id} className="border px-2 py-1">{p.fullName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-2 py-1">{t("coef")}</td>
              {people.map((p) => (
                <td key={p.id} className="border px-2 py-1">
                  <input
                    className="w-16 rounded border px-1"
                    type="number"
                    value={schedule.coefficients[p.id] ?? 100}
                    onChange={(e) =>
                      setSchedule({
                        ...schedule,
                        coefficients: { ...schedule.coefficients, [p.id]: Number(e.target.value) },
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-2 text-sm">
        {(["walkIn", "inHouse"] as const).map((group) => (
          <table key={group} className="w-full border-collapse">
            <caption className="mb-1 text-left">{group === "walkIn" ? t("walkIn") : t("inHouse")}</caption>
            <thead>
              <tr>
                <th className="border px-1" />
                <th className="border px-1">{t("refer")}</th>
                <th className="border px-1">{t("perform")}</th>
              </tr>
            </thead>
            <tbody>
              {BONUS_CATEGORIES.map((key) => (
                <tr key={key}>
                  <td className="border px-1">{t(key)}</td>
                  {(["refer", "perform"] as const).map((side) => (
                    <td key={side} className="border px-1">
                      <input
                        className="w-16 rounded border px-1"
                        type="number"
                        value={schedule[group][key][side]}
                        onChange={(e) =>
                          setSchedule({
                            ...schedule,
                            [group]: {
                              ...schedule[group],
                              [key]: { ...schedule[group][key], [side]: Number(e.target.value) },
                            },
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <button type="button" className="mt-4 rounded bg-[#1F4E79] px-3 py-1 text-white" onClick={() => void save()}>
        {t("save")}
      </button>
      {month ? (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left"> </th>
              <th className="border px-2 py-1">{t("turnover")}</th>
              <th className="border px-2 py-1">{t("bonus")}</th>
            </tr>
          </thead>
          <tbody>
            {month.lines.map((line) => (
              <tr key={line.practitionerId}>
                <td className="border px-2 py-1">{line.name}</td>
                <td className="border px-2 py-1">{line.turnover}</td>
                <td className="border px-2 py-1">{line.bonus}</td>
              </tr>
            ))}
            <tr>
              <td className="border px-2 py-1">{t("fundRow")}</td>
              <td className="border px-2 py-1">{month.fundTurnover}</td>
              <td className="border px-2 py-1">{month.fundBonus}</td>
            </tr>
            <tr>
              <td className="border px-2 py-1 font-semibold">{t("total")}</td>
              <td className="border px-2 py-1" />
              <td className="border px-2 py-1 font-semibold">{month.total}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
