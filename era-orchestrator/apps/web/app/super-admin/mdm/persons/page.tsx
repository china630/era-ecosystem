"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  GHOST_BUTTON_CLASS,
  ListPaginationFooter,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useListPagination } from "../../../../lib/use-list-pagination";

type LookupResult = {
  found: boolean;
  globalPersonId?: string;
  fullName?: string | null;
  phone?: string | null;
  masked?: boolean;
};

type IdentifiersResult = {
  globalPersonId: string;
  identifiers: Array<{
    id: string;
    type: string;
    issuingCountry: string;
    isPrimary: boolean;
    trust: string;
  }>;
};

export default function SuperAdminMdmPersonsPage() {
  const t = useTranslations("superAdmin.mdmPersons");
  const tCommon = useTranslations("common");
  const [fin, setFin] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [identifiers, setIdentifiers] = useState<IdentifiersResult | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [resolveFin, setResolveFin] = useState("");
  const [resolveName, setResolveName] = useState("");
  const [resolvePhone, setResolvePhone] = useState("");

  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");

  const idRows = identifiers?.identifiers ?? [];
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(idRows, identifiers?.globalPersonId);

  async function doLookup() {
    setBusy(true);
    setMsg("");
    setLookup(null);
    setIdentifiers(null);
    const res = await cpAdminFetch("mdm/persons/lookup-by-fin", {
      method: "POST",
      body: JSON.stringify({ fin: fin.trim().toUpperCase(), purpose: "super-admin" }),
    });
    const data = (await res.json()) as LookupResult & { message?: string };
    setBusy(false);
    if (!res.ok) {
      setMsg(data.message ?? t("lookupFailed"));
      return;
    }
    setLookup(data);
    if (data.found && data.globalPersonId) {
      const idRes = await cpAdminFetch(
        `mdm/persons/${encodeURIComponent(data.globalPersonId)}/identifiers`,
      );
      if (idRes.ok) setIdentifiers((await idRes.json()) as IdentifiersResult);
    }
  }

  async function doResolve() {
    setBusy(true);
    setMsg("");
    const res = await cpAdminFetch("mdm/persons/resolve", {
      method: "POST",
      body: JSON.stringify({
        fin: resolveFin.trim().toUpperCase(),
        fullName: resolveName.trim(),
        phone: resolvePhone.trim() || undefined,
        nationality: "AZ",
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(typeof data.message === "string" ? data.message : t("resolveFailed"));
      return;
    }
    setMsg(t("resolveOk", { id: data.globalPersonId ?? data.id ?? "?" }));
  }

  async function doMerge() {
    setBusy(true);
    setMsg("");
    const res = await cpAdminFetch("mdm/persons/merge", {
      method: "POST",
      body: JSON.stringify({
        sourcePersonId: mergeSource.trim(),
        targetPersonId: mergeTarget.trim(),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(typeof data.message === "string" ? data.message : t("mergeFailed"));
      return;
    }
    setMsg(t("mergeOk", { id: data.globalPersonId ?? "?" }));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin/mdm" className="text-sm text-[#2980B9]">
          ← {t("backHub")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("hint")}</p>
      </div>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("lookupTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={MODAL_INPUT_CLASS}
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            placeholder={t("finPlaceholder")}
            maxLength={7}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || fin.trim().length < 7}
            onClick={() => void doLookup()}
          >
            {t("lookupBtn")}
          </button>
        </div>
        {lookup && !lookup.found ? (
          <p className="rounded-lg bg-[#FAFBFC] p-3 text-sm text-[#7F8C8D]">{t("notFound")}</p>
        ) : null}
        {lookup && lookup.found ? (
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 rounded-lg bg-[#FAFBFC] p-3 text-[13px]">
            <dt className="text-[#7F8C8D]">{t("personId")}</dt>
            <dd className="font-mono text-[#34495E]">{lookup.globalPersonId ?? "—"}</dd>
            <dt className="text-[#7F8C8D]">{t("fullName")}</dt>
            <dd className="text-[#34495E]">{lookup.fullName ?? "—"}</dd>
            <dt className="text-[#7F8C8D]">{t("phone")}</dt>
            <dd className="text-[#34495E]">{lookup.phone ?? "—"}</dd>
            {lookup.masked ? (
              <>
                <dt className="text-[#7F8C8D]">{t("masked")}</dt>
                <dd className="text-amber-800">{t("maskedYes")}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {identifiers && identifiers.identifiers.length > 0 ? (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("idType")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("idCountry")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("idPrimary")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("idTrust")}</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((id) => (
                  <tr key={id.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{id.type}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{id.issuingCountry}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {id.isPrimary ? t("primaryYes") : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{id.trust}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPaginationFooter
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              labels={{
                rowsPerPage: tCommon("paginationRowsPerPage"),
                pageOf: tCommon("paginationPageOf"),
                prev: tCommon("paginationPrev"),
                next: tCommon("paginationNext"),
              }}
            />
          </div>
        ) : null}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("resolveTitle")}</h2>
        <input
          className={`${MODAL_INPUT_CLASS} w-full max-w-xs`}
          value={resolveFin}
          onChange={(e) => setResolveFin(e.target.value)}
          placeholder={t("finPlaceholder")}
        />
        <input
          className={`${MODAL_INPUT_CLASS} w-full max-w-md`}
          value={resolveName}
          onChange={(e) => setResolveName(e.target.value)}
          placeholder={t("fullNamePlaceholder")}
        />
        <input
          className={`${MODAL_INPUT_CLASS} w-full max-w-xs`}
          value={resolvePhone}
          onChange={(e) => setResolvePhone(e.target.value)}
          placeholder={t("phonePlaceholder")}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !resolveFin.trim() || !resolveName.trim()}
          onClick={() => void doResolve()}
        >
          {t("resolveBtn")}
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("mergeTitle")}</h2>
        <input
          className={`${MODAL_INPUT_CLASS} w-full max-w-md`}
          value={mergeSource}
          onChange={(e) => setMergeSource(e.target.value)}
          placeholder={t("sourceIdPlaceholder")}
        />
        <input
          className={`${MODAL_INPUT_CLASS} w-full max-w-md`}
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
          placeholder={t("targetIdPlaceholder")}
        />
        <button
          type="button"
          className={`${GHOST_BUTTON_CLASS} border border-[#E74C3C] text-[#E74C3C]`}
          disabled={busy || !mergeSource.trim() || !mergeTarget.trim()}
          onClick={() => void doMerge()}
        >
          {t("mergeBtn")}
        </button>
      </section>

      {msg && <p className="text-sm text-[#34495E]">{msg}</p>}
    </div>
  );
}
