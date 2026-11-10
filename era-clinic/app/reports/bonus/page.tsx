"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  LIST_PAGE_SHELL_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";
import type { BonusSchedule } from "@/domain/reports/bonus-schedule";
import { BONUS_CATEGORIES } from "@/domain/reports/bonus-schedule";

type Person = { id: string; fullName: string; staffKind: string };
type Month = {
  lines: Array<{
    practitionerId: string;
    name: string;
    turnover: number;
    bonus: number;
    shareOfTotal: number;
  }>;
  fundTurnover: number;
  fundBonus: number;
  fundShare: number;
  total: number;
};

function withDoctors(schedule: BonusSchedule): BonusSchedule {
  const extra = [schedule.labPractitionerId, schedule.usPractitionerId].filter(
    (id): id is string => Boolean(id) && !schedule.memberIds.includes(id as string),
  );
  if (extra.length === 0) return schedule;
  return {
    ...schedule,
    memberIds: [...schedule.memberIds, ...extra],
    coefficients: {
      ...schedule.coefficients,
      ...Object.fromEntries(extra.map((id) => [id, schedule.coefficients[id] ?? 100])),
    },
  };
}

export default function BonusReportPage() {
  const t = useTranslations("bonusReport");
  const tc = useTranslations("nav");
  const [from, setFrom] = useState(addBakuDays(todayBakuYmd(), -30));
  const [to, setTo] = useState(todayBakuYmd());
  const [schedule, setSchedule] = useState<BonusSchedule | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [month, setMonth] = useState<Month | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<BonusSchedule | null>(null);
  const [pickId, setPickId] = useState("");

  async function load(nextFrom = from, nextTo = to) {
    const res = await fetch(`/api/reports/bonus?from=${nextFrom}&to=${nextTo}`);
    const body = await res.json();
    if (!res.ok) {
      showApiError(body, t("save"));
      return;
    }
    const data = body.data ?? body;
    setSchedule(withDoctors(data.schedule));
    setPeople(data.people ?? []);
    setMonth(data.month);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  function openSettings() {
    if (!schedule) return;
    setDraft(withDoctors(structuredClone(schedule)));
    setPickId("");
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setDraft(null);
    setPickId("");
  }

  async function save() {
    if (!draft) return;
    const res = await fetch("/api/reports/bonus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withDoctors(draft)),
    });
    const body = await res.json();
    if (!res.ok) {
      showApiError(body, t("save"));
      return;
    }
    showSuccess(t("saved"));
    closeSettings();
    await load();
  }

  function addMember() {
    if (!draft || !pickId || draft.memberIds.includes(pickId)) return;
    setDraft({
      ...draft,
      memberIds: [...draft.memberIds, pickId],
      coefficients: { ...draft.coefficients, [pickId]: draft.coefficients[pickId] ?? 100 },
    });
    setPickId("");
  }

  function removeMember(id: string) {
    if (!draft) return;
    const coefficients = { ...draft.coefficients };
    delete coefficients[id];
    setDraft({
      ...draft,
      memberIds: draft.memberIds.filter((row) => row !== id),
      coefficients,
      labPractitionerId: draft.labPractitionerId === id ? null : draft.labPractitionerId,
      usPractitionerId: draft.usPractitionerId === id ? null : draft.usPractitionerId,
    });
  }

  if (!schedule) return null;

  const sheet = draft ?? schedule;
  const nameById = new Map(people.map((p) => [p.id, p.fullName]));
  const staffOptions = people.map((p) => ({ value: p.id, label: p.fullName }));
  const available = staffOptions.filter((p) => !sheet.memberIds.includes(p.value));

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={tc("bonusReport")}
        actions={
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={openSettings}>
            {t("settings")}
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <DatePicker label={t("from")} value={from} onChange={setFrom} placeholder="dd.mm.yyyy" />
        <DatePicker label={t("to")} value={to} onChange={setTo} placeholder="dd.mm.yyyy" />
      </div>
      {month && month.lines.length === 0 ? (
        <p className="mb-3 text-sm text-slate-600">{t("emptyRoster")}</p>
      ) : null}
      {month ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-right">{t("shareOfTotal")}</th>
              <th className="border px-2 py-1 text-left">{t("name")}</th>
              <th className="border px-2 py-1 text-right">{t("turnover")}</th>
              <th className="border px-2 py-1 text-right">{t("bonus")}</th>
            </tr>
          </thead>
          <tbody>
            {month.lines.map((line) => (
              <tr key={line.practitionerId}>
                <td className="border px-2 py-1 text-right">{line.shareOfTotal}</td>
                <td className="border px-2 py-1">{line.name}</td>
                <td className="border px-2 py-1 text-right">{line.turnover}</td>
                <td className="border px-2 py-1 text-right">{line.bonus}</td>
              </tr>
            ))}
            <tr>
              <td className="border px-2 py-1 text-right">{month.fundShare}</td>
              <td className="border px-2 py-1">{t("fundRow")}</td>
              <td className="border px-2 py-1 text-right">{month.fundTurnover}</td>
              <td className="border px-2 py-1 text-right">{month.fundBonus}</td>
            </tr>
            <tr>
              <td className="border px-2 py-1" />
              <td className="border px-2 py-1 font-semibold">{t("total")}</td>
              <td className="border px-2 py-1" />
              <td className="border px-2 py-1 text-right font-semibold">{month.total}</td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <ModalShell open={settingsOpen && draft != null} title={t("settings")} onClose={closeSettings}>
        {draft ? (
        <>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <label>
            {t("vat")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              type="number"
              value={draft.vatPercent}
              onChange={(e) => setDraft({ ...draft, vatPercent: Number(e.target.value) })}
            />
          </label>
          <label>
            {t("profit")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              type="number"
              value={draft.profitTaxPercent}
              onChange={(e) => setDraft({ ...draft, profitTaxPercent: Number(e.target.value) })}
            />
          </label>
          <label>
            {t("fund")}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              type="number"
              value={draft.fundPercent}
              onChange={(e) => setDraft({ ...draft, fundPercent: Number(e.target.value) })}
            />
          </label>
          <CatalogField
            kind="SEARCHABLE"
            label={t("labDoctor")}
            value={draft.labPractitionerId ?? ""}
            options={[{ value: "", label: t("none") }, ...staffOptions]}
            onChange={(value) =>
              setDraft(withDoctors({ ...draft, labPractitionerId: String(value) || null }))
            }
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t("usDoctor")}
            value={draft.usPractitionerId ?? ""}
            options={[{ value: "", label: t("none") }, ...staffOptions]}
            onChange={(value) =>
              setDraft(withDoctors({ ...draft, usPractitionerId: String(value) || null }))
            }
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2 text-sm">
          <div className="min-w-64 flex-1">
            <CatalogField
              kind="SEARCHABLE"
              label={t("addMember")}
              value={pickId}
              options={[{ value: "", label: t("none") }, ...available]}
              onChange={(value) => setPickId(String(value ?? ""))}
            />
          </div>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!pickId} onClick={addMember}>
            {t("add")}
          </button>
        </div>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">{t("name")}</th>
              <th className="border px-2 py-1">{t("coef")}</th>
              <th className="border px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {draft.memberIds.map((id) => (
              <tr key={id}>
                <td className="border px-2 py-1">{nameById.get(id) ?? id}</td>
                <td className="border px-2 py-1">
                  <input
                    className="w-20 rounded border px-1"
                    type="number"
                    value={draft.coefficients[id] ?? 100}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        coefficients: { ...draft.coefficients, [id]: Number(e.target.value) },
                      })
                    }
                  />
                </td>
                <td className="border px-2 py-1">
                  <button type="button" className="text-[#1F4E79]" onClick={() => removeMember(id)}>
                    {t("remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
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
                          value={draft[group][key][side]}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [group]: {
                                ...draft[group],
                                [key]: { ...draft[group][key], [side]: Number(e.target.value) },
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
        <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-4`} onClick={() => void save()}>
          {t("save")}
        </button>
        </>
        ) : null}
      </ModalShell>
    </div>
  );
}
