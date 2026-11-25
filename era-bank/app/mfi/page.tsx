"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { todayBakuYmd } from "@era/satellite-kit/time";
import {
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { formatAznMinor } from "@/components/ops-ui";

type Group = {
  id: string;
  name?: string;
  status?: string;
  officerId?: string | null;
};

type Sheet = {
  id: string;
  meetingDate?: string;
  status?: string;
  linesJson?: Array<{
    customerId: string;
    loanId?: string;
    amountDueMinor: string;
    amountCollectedMinor?: string;
  }>;
};

type Par30Row = {
  officerId: string;
  loanCount: number;
  par30Count: number;
  outstandingPar30Minor: string;
};

export default function MfiPage() {
  const t = useTranslations("pages.mfi");
  const tCommon = useTranslations("common");
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [officer, setOfficer] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [meetingDate, setMeetingDate] = useState(() => todayBakuYmd());
  const [collectAmount, setCollectAmount] = useState("0");
  const [par30, setPar30] = useState<Par30Row[]>([]);

  const load = useCallback(async () => {
    try {
      const [gRes, pRes] = await Promise.all([
        fetch("/api/mfi/groups", { cache: "no-store" }),
        fetch("/api/mfi/par30-by-officer", { cache: "no-store" }),
      ]);
      if (gRes.ok) setGroups((await gRes.json()) as Group[]);
      if (pRes.ok) {
        const data = await pRes.json();
        setPar30(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.rows)
              ? data.rows
              : [],
        );
      }
      if (!gRes.ok) showApiError(tCommon("error"));
    } catch {
      showApiError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadSheets(groupId: string) {
    setSelectedGroupId(groupId);
    const res = await fetch(`/api/mfi/groups/${groupId}/collection-sheets`, {
      cache: "no-store",
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    setSheets((await res.json()) as Sheet[]);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/mfi/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        officerId: officer || undefined,
      }),
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    setName("");
    await load();
  }

  async function activate(id: string) {
    const res = await fetch(`/api/mfi/groups/${id}/activate`, { method: "POST" });
    if (!res.ok) showApiError(await res.text());
    await load();
  }

  async function createSheet(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroupId) return;
    const res = await fetch(
      `/api/mfi/groups/${selectedGroupId}/collection-sheets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingDate }),
      },
    );
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    await loadSheets(selectedGroupId);
  }

  async function collectSheet(sheet: Sheet) {
    const lines = (sheet.linesJson ?? []).map((line) => ({
      customerId: line.customerId,
      loanId: line.loanId,
      amountCollectedMinor:
        collectAmount && Number(collectAmount) > 0
          ? String(Math.round(Number(collectAmount) * 100))
          : line.amountDueMinor,
    }));
    const res = await fetch(`/api/mfi/collection-sheets/${sheet.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    if (!res.ok) {
      showApiError(await res.text());
      return;
    }
    if (selectedGroupId) await loadSheets(selectedGroupId);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <form className="space-y-2 rounded-xl border p-4" onSubmit={createGroup}>
        <Field
          label={t("groupName")}
          preset="shortText"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Field
          label={t("fieldOfficer")}
          preset="code"
          value={officer}
          onChange={(e) => setOfficer(e.target.value)}
        />
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {t("create")}
        </button>
      </form>
      <ul className="space-y-2 text-sm">
        {groups.map((g) => (
          <li
            key={g.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
          >
            <span>
              {g.name} · {g.status} · officer {g.officerId ?? "—"} · {g.id}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void loadSheets(g.id)}
              >
                {t("sheets")}
              </button>
              {g.status !== "ACTIVE" ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void activate(g.id)}
                >
                  {t("activate")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {selectedGroupId ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-medium">
            {t("sheets")} · {selectedGroupId}
          </h2>
          <form className="flex flex-wrap items-end gap-2" onSubmit={createSheet}>
            <Field
              label={t("meetingDate")}
              preset="code"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              {t("createSheet")}
            </button>
          </form>
          <Field
            label={t("collectAmount")}
            preset="amount"
            type="number"
            step="0.01"
            value={collectAmount}
            onChange={(e) => setCollectAmount(e.target.value)}
          />
          <ul className="space-y-2 text-sm">
            {sheets.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <span>
                  {s.meetingDate?.slice(0, 10)} · {s.status} ·{" "}
                  {(s.linesJson ?? []).length} lines
                </span>
                {s.status === "OPEN" ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void collectSheet(s)}
                  >
                    {t("collect")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="rounded-xl border p-4 text-sm space-y-2">
        <h2 className="font-medium">{t("par30")}</h2>
        {par30.length === 0 ? (
          <p className="text-slate-500">{t("par30Empty")}</p>
        ) : (
          <ul className="space-y-1">
            {par30.map((row) => (
              <li key={row.officerId} className="rounded border px-3 py-2">
                {row.officerId}: PAR30 {row.par30Count}/{row.loanCount} ·{" "}
                {formatAznMinor(row.outstandingPar30Minor)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
