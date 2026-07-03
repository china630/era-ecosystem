"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../../lib/orch-api";
import { useRequireAuth } from "../../../../../lib/use-require-auth";

type EmploymentRow = { id: string; globalPersonId: string; status: string };

async function workforceFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`/api/platform/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

export default function NewWorkforceAbsencePage() {
  const router = useRouter();
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceAbsences");
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [employmentId, setEmploymentId] = useState("");
  const [kind, setKind] = useState<"VACATION" | "SICK" | "UNPAID">("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void workforceFetch("employments?status=ACTIVE").then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as { items: EmploymentRow[] };
      const items = data.items ?? [];
      setEmployments(items);
      if (items[0]) setEmploymentId(items[0].id);
    });
  }, [ready, user?.organizationId]);

  async function onSubmit(e: React.FormEvent, submit: boolean) {
    e.preventDefault();
    if (busy || !employmentId || !startDate || !endDate) return;
    setBusy(true);
    setError(null);
    const res = await workforceFetch("absences", {
      method: "POST",
      body: JSON.stringify({
        employmentId,
        kind,
        startDate,
        endDate,
        note,
        submit,
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      setBusy(false);
      return;
    }
    const row = (await res.json()) as { id: string };
    router.push(`/workspace/workforce/absences/${row.id}`);
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title={t("newTitle")}
        subtitle={t("newSubtitle")}
        actions={
          <Link href="/workspace/workforce/absences" className={SECONDARY_BUTTON_CLASS}>
            {t("back")}
          </Link>
        }
      />

      <form className={`${CARD_CONTAINER_CLASS} max-w-xl space-y-3 p-4`}>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldEmployment")}
          <select
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={employmentId}
            onChange={(e) => setEmploymentId(e.target.value)}
            required
          >
            {employments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id.slice(0, 8)}… ({e.status})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("colKind")}
          <select
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="VACATION">{t("kind.VACATION")}</option>
            <option value="SICK">{t("kind.SICK")}</option>
            <option value="UNPAID">{t("kind.UNPAID")}</option>
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldFrom")}
          <input
            type="date"
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldTo")}
          <input
            type="date"
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("fieldNote")}
          <textarea
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy}
            onClick={(e) => void onSubmit(e, false)}
          >
            {t("saveDraft")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={(e) => void onSubmit(e, true)}
          >
            {busy ? t("busy") : t("submit")}
          </button>
        </div>
      </form>
    </>
  );
}
