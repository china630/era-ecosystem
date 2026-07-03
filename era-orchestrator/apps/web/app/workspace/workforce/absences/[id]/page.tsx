"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../../lib/orch-api";
import { useRequireAuth } from "../../../../../lib/use-require-auth";

type AbsenceDetail = {
  id: string;
  kind: string;
  status: string;
  startDate: string;
  endDate: string;
  note: string;
  rejectionReason?: string | null;
  person?: { displayName: string | null; accessDenied: boolean } | null;
};

async function workforceFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/platform/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

export default function WorkforceAbsenceDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceAbsences");
  const [row, setRow] = useState<AbsenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const id = params?.id ?? "";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await workforceFetch(`absences/${id}`);
    if (!res.ok) {
      setError(`${res.status}`);
      setRow(null);
      setLoading(false);
      return;
    }
    setRow((await res.json()) as AbsenceDetail);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!ready || !user?.organizationId || !id) return;
    void load();
  }, [ready, user?.organizationId, id, load]);

  async function action(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await workforceFetch(path, {
      method: "POST",
      ...(body != null
        ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
        : {}),
    });
    if (!res.ok) {
      setError(await res.text());
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title={t("detailTitle")}
        subtitle={id ? `#${id.slice(0, 8)}` : ""}
        actions={
          <Link href="/workspace/workforce/absences" className={SECONDARY_BUTTON_CLASS}>
            {t("back")}
          </Link>
        }
      />

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : !row ? (
        <p className="text-sm text-red-700">{error ?? t("notFound")}</p>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} max-w-xl space-y-3 p-4`}>
          <p className="text-[13px]">
            <span className="font-semibold text-[#34495E]">{t("colPerson")}: </span>
            {row.person?.displayName ?? (row.person?.accessDenied ? t("maskedPerson") : "—")}
          </p>
          <p className="text-[13px]">
            <span className="font-semibold text-[#34495E]">{t("colKind")}: </span>
            {t(`kind.${row.kind}` as "kind.VACATION")}
          </p>
          <p className="text-[13px]">
            <span className="font-semibold text-[#34495E]">{t("colPeriod")}: </span>
            {String(row.startDate).slice(0, 10)} — {String(row.endDate).slice(0, 10)}
          </p>
          <p className="text-[13px]">
            <span className="font-semibold text-[#34495E]">{t("colStatus")}: </span>
            {t(`status.${row.status}` as "status.DRAFT")}
          </p>
          {row.note ? (
            <p className="text-[13px]">
              <span className="font-semibold text-[#34495E]">{t("fieldNote")}: </span>
              {row.note}
            </p>
          ) : null}
          {row.rejectionReason ? (
            <p className="text-[13px] text-red-700">{row.rejectionReason}</p>
          ) : null}

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {row.status === "DRAFT" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void action(`absences/${id}/submit`)}
              >
                {t("submit")}
              </button>
            ) : null}
            {row.status === "SUBMITTED" ? (
              <>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void action(`absences/${id}/approve`)}
                >
                  {t("approve")}
                </button>
                <div className="w-full space-y-2">
                  <input
                    className="block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                    placeholder={t("rejectReasonPlaceholder")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() =>
                      void action(`absences/${id}/reject`, {
                        rejectionReason: rejectReason,
                      })
                    }
                  >
                    {t("reject")}
                  </button>
                </div>
              </>
            ) : null}
            {row.status === "APPROVED" ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void action(`absences/${id}/cancel`)}
              >
                {t("cancel")}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
