"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { accountDisplayName } from "../../../lib/account-display-name";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { uiLangRuAz } from "../../../lib/i18n/ui-lang";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { PageHeader } from "../../../components/layout/page-header";

type AccountRow = {
  id: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  displayName?: string;
  type: string;
};

type BookRow = {
  id: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  status: string;
};

type SetSummary = {
  id: string;
  code?: string;
  fromBookId: string | null;
  toBookId: string | null;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  _count?: { lines: number };
};

type SetDetail = {
  id: string;
  code?: string;
  fromBookId: string | null;
  toBookId: string | null;
  version: number;
  status: string;
  coverage?: {
    nasAccountCount: number;
    mappedNasCount: number;
    coveragePct: number;
  };
  lines: Array<{
    id: string;
    ratio: string;
    sourceAccount: AccountRow;
    targetAccount: AccountRow;
  }>;
};

type FailedMirror = {
  id: string;
  date: string;
  reference: string | null;
  mirrorErrorCode: string | null;
};

function canEdit(role: string | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "ACCOUNTANT";
}

function LedgerMappingsContent() {
  const { t, i18n } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const edit = canEdit(user?.role ?? undefined);

  const [sets, setSets] = useState<SetSummary[]>([]);
  const [active, setActive] = useState<SetDetail | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<AccountRow[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<AccountRow[]>([]);
  const [fromBookId, setFromBookId] = useState("");
  const [toBookId, setToBookId] = useState("");
  const [mappingCode, setMappingCode] = useState("");
  const [nasId, setNasId] = useState("");
  const [ifrsId, setIfrsId] = useState("");
  const [ratio, setRatio] = useState("1");
  const [failed, setFailed] = useState<FailedMirror[]>([]);
  const [mirrorMode, setMirrorMode] = useState<"soft" | "strict">("soft");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const [rSets, rBooks, rFailed, rOrg] = await Promise.all([
      apiFetch("/api/accounting/ledger-mappings"),
      apiFetch("/api/accounting/books"),
      apiFetch("/api/accounting/ledger-mappings/failed-mirrors?take=50"),
      apiFetch("/api/organization/settings"),
    ]);
    if (!rSets.ok) {
      setErr(`${t("mapping.loadErr")}: ${rSets.status}`);
      return;
    }
    const list = (await rSets.json()) as SetSummary[];
    setSets(list);
    if (rBooks.ok) {
      setBooks(
        ((await rBooks.json()) as BookRow[]).filter((book) => book.status === "ACTIVE"),
      );
    }
    if (rFailed.ok) setFailed((await rFailed.json()) as FailedMirror[]);
    if (rOrg.ok) {
      const org = (await rOrg.json()) as {
        settings?: { ledgerMirror?: { mode?: string } };
      };
      setMirrorMode(org.settings?.ledgerMirror?.mode === "strict" ? "strict" : "soft");
    }
    const draft = list.find((s) => s.status === "DRAFT");
    const published = list.find((s) => s.status === "PUBLISHED");
    const pick = draft ?? published ?? list[0];
    if (pick) {
      const detail = await apiFetch(`/api/accounting/ledger-mappings/${pick.id}`);
      if (detail.ok) setActive((await detail.json()) as SetDetail);
    } else {
      setActive(null);
    }
  }, [token, t, i18n.language]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  useEffect(() => {
    if (!token || !active?.fromBookId || !active.toBookId) {
      setSourceAccounts([]);
      setTargetAccounts([]);
      return;
    }
    setFromBookId(active.fromBookId);
    setToBookId(active.toBookId);
    const loc = encodeURIComponent(uiLangRuAz(i18n.language));
    void Promise.all([
      apiFetch(
        `/api/accounts?accountingBookId=${encodeURIComponent(active.fromBookId)}&locale=${loc}`,
      ),
      apiFetch(
        `/api/accounts?accountingBookId=${encodeURIComponent(active.toBookId)}&locale=${loc}`,
      ),
    ]).then(async ([sourceResponse, targetResponse]) => {
      setSourceAccounts(
        sourceResponse.ok ? ((await sourceResponse.json()) as AccountRow[]) : [],
      );
      setTargetAccounts(
        targetResponse.ok ? ((await targetResponse.json()) as AccountRow[]) : [],
      );
    });
  }, [active?.fromBookId, active?.toBookId, i18n.language, token]);

  async function ensureDraft() {
    if (!edit || !token) return;
    if (!fromBookId || !toBookId || fromBookId === toBookId) {
      setErr(t("mapping.bookPairRequired", "Choose source and target books first"));
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await apiFetch("/api/accounting/ledger-mappings/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromBookId,
        toBookId,
        code: mappingCode.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`${t("mapping.createErr")}: ${res.status}`);
      return;
    }
    setActive((await res.json()) as SetDetail);
    setMappingCode("");
    setMsg(t("mapping.draftReady", "Draft mapping set ready"));
    await load();
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || !active || active.status !== "DRAFT" || !nasId || !ifrsId) return;
    setBusy(true);
    setErr(null);
    const lines = [
      ...active.lines.map((l) => ({
        sourceAccountId: l.sourceAccount.id,
        targetAccountId: l.targetAccount.id,
        ratio: String(l.ratio),
      })),
      { sourceAccountId: nasId, targetAccountId: ifrsId, ratio },
    ];
    const res = await apiFetch(`/api/accounting/ledger-mappings/${active.id}/lines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`${t("mapping.createErr")}: ${res.status}`);
      return;
    }
    setActive((await res.json()) as SetDetail);
    setNasId("");
    setIfrsId("");
    setRatio("1");
  }

  async function removeLine(lineId: string) {
    if (!edit || !active || active.status !== "DRAFT") return;
    setBusy(true);
    setErr(null);
    const lines = active.lines
      .filter((l) => l.id !== lineId)
      .map((l) => ({
        sourceAccountId: l.sourceAccount.id,
        targetAccountId: l.targetAccount.id,
        ratio: String(l.ratio),
      }));
    const res = await apiFetch(`/api/accounting/ledger-mappings/${active.id}/lines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`${t("mapping.createErr")}: ${res.status}`);
      return;
    }
    setActive((await res.json()) as SetDetail);
  }

  async function publish() {
    if (!edit || !active || active.status !== "DRAFT") return;
    setBusy(true);
    setErr(null);
    const res = await apiFetch(`/api/accounting/ledger-mappings/${active.id}/publish`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`${t("mapping.publishErr", "Publish failed")}: ${res.status}`);
      return;
    }
    setMsg(t("mapping.published", "Mapping set published"));
    await load();
  }

  async function saveMirrorMode(mode: "soft" | "strict") {
    if (!edit || !token) return;
    setBusy(true);
    const res = await apiFetch("/api/organization/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledgerMirrorMode: mode }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(`${t("mapping.modeErr", "Could not save mirror mode")}: ${res.status}`);
      return;
    }
    setMirrorMode(mode);
  }

  async function retryMirror(id: string) {
    if (!edit) return;
    setBusy(true);
    const res = await apiFetch(
      `/api/accounting/ledger-mappings/mirror/retry/${id}`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(`${t("mapping.retryErr", "Retry failed")}: ${res.status}`);
      return;
    }
    setMsg(t("mapping.retryOk", "Mirror retry finished"));
    await load();
  }

  const lang = uiLangRuAz(i18n.language);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("mapping.ledgerTitle", "Accounting book mapping")}
        subtitle={
          <Fragment>
            <p className="m-0">
              {t(
                "mapping.ledgerHint",
                "Versioned mapping sets for arbitrary accounting-book pairs. NAS_TO_IFRS remains the automatic mirror pair.",
              )}
            </p>
          </Fragment>
        }
      />

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold">
          {t("mapping.mirrorMode", "Mirror mode")}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!edit || busy || mirrorMode === "soft"}
            className={mirrorMode === "soft" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => void saveMirrorMode("soft")}
          >
            soft
          </button>
          <button
            type="button"
            disabled={!edit || busy || mirrorMode === "strict"}
            className={mirrorMode === "strict" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => void saveMirrorMode("strict")}
          >
            strict
          </button>
        </div>
      </div>

      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold grow">
            {t("mapping.sets", "Mapping sets")}
          </h2>
          {edit ? (
            <>
              <label className="text-xs">
                {t("mapping.fromBook", "Source book")}
                <select
                  className={`${INPUT_BORDERED_CLASS} ml-1`}
                  value={fromBookId}
                  onChange={(e) => setFromBookId(e.target.value)}
                >
                  <option value="">—</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                {t("mapping.toBook", "Target book")}
                <select
                  className={`${INPUT_BORDERED_CLASS} ml-1`}
                  value={toBookId}
                  onChange={(e) => setToBookId(e.target.value)}
                >
                  <option value="">—</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id} disabled={book.id === fromBookId}>
                      {book.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                {t("mapping.mappingCode", "Code (auto if blank)")}
                <input
                  className={`${INPUT_BORDERED_CLASS} ml-1 max-w-44`}
                  value={mappingCode}
                  onChange={(e) => setMappingCode(e.target.value)}
                  placeholder="NAS_TO_IFRS"
                  pattern="[A-Za-z0-9_-]+"
                  maxLength={64}
                />
              </label>
            </>
          ) : null}
          {edit ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void ensureDraft()}
            >
              {t("mapping.ensureDraft", "New / open draft")}
            </button>
          ) : null}
          {edit && active?.status === "DRAFT" ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || (active.lines?.length ?? 0) === 0}
              onClick={() => void publish()}
            >
              {t("mapping.publish", "Publish")}
            </button>
          ) : null}
        </div>
        <ul className="text-sm space-y-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="underline"
                onClick={() => {
                  void apiFetch(`/api/accounting/ledger-mappings/${s.id}`).then(
                    async (r) => {
                      if (r.ok) setActive((await r.json()) as SetDetail);
                    },
                  );
                }}
              >
                {s.code ?? "—"} · v{s.version} · {s.status} · {s._count?.lines ?? "?"} lines
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
          <h2 className="text-sm font-semibold">
            {active.code ?? "—"} · v{active.version} · {active.status}
            {active.coverage
              ? ` · ${t("mapping.coverage", "Coverage")} ${active.coverage.coveragePct}% (${active.coverage.mappedNasCount}/${active.coverage.nasAccountCount})`
              : ""}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">{t("mapping.fromBook", "Source book")}</th>
                <th className="py-1">{t("mapping.toBook", "Target book")}</th>
                <th className="py-1">ratio</th>
                {edit && active.status === "DRAFT" ? (
                  <th className="py-1">{t("mapping.thActions", "Actions")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {active.lines.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="py-1">
                    {l.sourceAccount.code} —{" "}
                    {accountDisplayName(l.sourceAccount, lang)}
                  </td>
                  <td className="py-1">
                    {l.targetAccount.code} —{" "}
                    {accountDisplayName(l.targetAccount, lang)}
                  </td>
                  <td className="py-1">{String(l.ratio)}</td>
                  {edit && active.status === "DRAFT" ? (
                    <td className="py-1">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => void removeLine(l.id)}
                      >
                        {t("mapping.delete", "Delete")}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          {edit && active.status === "DRAFT" ? (
            <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => void addLine(e)}>
              <label className="text-xs">
                {t("mapping.sourceAccount", "Source account")}
                <select
                  className={INPUT_BORDERED_CLASS}
                  value={nasId}
                  onChange={(e) => setNasId(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {sourceAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {accountDisplayName(a, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                {t("mapping.targetAccount", "Target account")}
                <select
                  className={INPUT_BORDERED_CLASS}
                  value={ifrsId}
                  onChange={(e) => setIfrsId(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {targetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {accountDisplayName(a, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                ratio
                <input
                  className={INPUT_BORDERED_CLASS}
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                />
              </label>
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {t("mapping.addLine", "Add line")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
        <h2 className="text-sm font-semibold">
          {t("mapping.failedQueue", "Failed IFRS mirrors")}
        </h2>
        {failed.length === 0 ? (
          <p className="text-sm text-gray-500">{t("mapping.noFailed", "None")}</p>
        ) : (
          <ul className="text-sm space-y-2">
            {failed.map((f) => (
              <li key={f.id} className="flex flex-wrap gap-2 items-center">
                <span>
                  {String(f.date).slice(0, 10)} · {f.reference ?? f.id} ·{" "}
                  {f.mirrorErrorCode}
                </span>
                {edit ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void retryMirror(f.id)}
                  >
                    {t("mapping.retry", "Retry")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function LedgerMappingsPage() {
  return (
    <SubscriptionPaywall module="ifrsMapping">
      <LedgerMappingsContent />
    </SubscriptionPaywall>
  );
}
