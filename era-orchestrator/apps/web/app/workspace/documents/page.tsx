"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DatePicker,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import { getOrchAccessToken, orchFetch } from "../../../lib/orch-api";
import { DocumentsNav } from "../../../components/documents/documents-nav";

type Lookup = {
  employments: Array<{ id: string; positionName: string; orgUnitName: string }>;
  orgUnits: Array<{ id: string; name: string }>;
};

type CaseRow = {
  id: string;
  kind: string;
  status: string;
  title: string;
  regNumber: string | null;
  correspondent: string | null;
  overdue: boolean;
  taskOverdue: boolean;
  replyTo: { regNumber: string | null } | null;
};

export default function DocumentsPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("documentsOffice");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [kind, setKind] = useState("INCOMING");
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [authorEmploymentId, setAuthorEmploymentId] = useState("");
  const [correspondent, setCorrespondent] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [amount, setAmount] = useState("");
  const [replyToId, setReplyToId] = useState("");
  const [links, setLinks] = useState<CaseRow[]>([]);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const access = () => getOrchAccessToken() ?? token;

  const load = useCallback(async () => {
    const tokenValue = access();
    if (!tokenValue) return;
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (status) params.set("status", status);
    const [listRes, lookRes, linkRes] = await Promise.all([
      orchFetch(`/v1/documents/cases?${params}`, { token: tokenValue }),
      orchFetch("/v1/documents/lookups", { token: tokenValue }),
      orchFetch("/v1/documents/cases", { token: tokenValue }),
    ]);
    if (!listRes.ok) {
      setError(t("loadFailed"));
      return;
    }
    setRows((await listRes.json()) as CaseRow[]);
    if (linkRes.ok) setLinks((await linkRes.json()) as CaseRow[]);
    if (lookRes.ok) {
      const data = (await lookRes.json()) as Lookup;
      setLookup(data);
      setAuthorEmploymentId((current) => current || data.employments[0]?.id || "");
    }
  }, [kind, status, token, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const tokenValue = access();
    if (!tokenValue || !title.trim() || !authorEmploymentId) return;
    setError(null);
    const res = await orchFetch("/v1/documents/cases", {
      token: tokenValue,
      method: "POST",
      body: JSON.stringify({
        kind,
        title: title.trim(),
        authorEmploymentId,
        correspondent: correspondent.trim() || undefined,
        dueOn: dueOn || undefined,
        amount: amount === "" ? undefined : Number(amount),
        replyToId: replyToId || undefined,
        orgUnitId: orgUnitId || undefined,
      }),
    });
    if (!res.ok) {
      setError(t("saveFailed"));
      return;
    }
    setTitle("");
    setCorrespondent("");
    await load();
  }

  if (!ready) return null;
  const kinds = ["INCOMING", "OUTGOING", "INTERNAL"].map((value) => ({
    value,
    label: t(`kind_${value}`),
  }));
  const statuses = ["", "DRAFT", "REGISTERED", "IN_ROUTE", "COMPLETED", "REJECTED", "ARCHIVED"].map(
    (value) => ({ value, label: value ? t(`status_${value}`) : t("statusAny") }),
  );

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DocumentsNav />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <form onSubmit={onCreate} className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <CatalogField kind="CLOSED_SMALL" label={t("fieldKind")} value={kind} onChange={(v) => setKind(String(v))} options={kinds} />
        <CatalogField
          kind="SEARCHABLE"
          label={t("fieldAuthor")}
          value={authorEmploymentId}
          onChange={(v) => setAuthorEmploymentId(String(v))}
          options={(lookup?.employments ?? []).map((row) => ({
            value: row.id,
            label: `${row.positionName} · ${row.orgUnitName}`,
          }))}
        />
        <Field preset="shortText" label={t("fieldTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field preset="shortText" label={t("fieldCorrespondent")} value={correspondent} onChange={(e) => setCorrespondent(e.target.value)} />
        <DatePicker label={t("fieldDue")} value={dueOn} onChange={setDueOn} />
        <Field preset="shortText" label={t("fieldAmount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <CatalogField
          kind="SEARCHABLE"
          label={t("fieldReplyTo")}
          value={replyToId}
          onChange={(v) => setReplyToId(String(v))}
          options={links.filter((row) => row.regNumber).map((row) => ({ value: row.id, label: `${row.regNumber} · ${row.title}` }))}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t("fieldOrgUnit")}
          value={orgUnitId}
          onChange={(v) => setOrgUnitId(String(v))}
          options={(lookup?.orgUnits ?? []).map((row) => ({ value: row.id, label: row.name }))}
        />
        <button className={PRIMARY_BUTTON_CLASS} type="submit">{t("create")}</button>
      </form>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <CatalogField kind="CLOSED_SMALL" label={t("filterStatus")} value={status} onChange={(v) => setStatus(String(v))} options={statuses} />
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>{t("colNumber")}</th>
              <th>{t("colTitle")}</th>
              <th>{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="py-2">{row.regNumber ?? "—"}{row.replyTo?.regNumber ? ` → ${row.replyTo.regNumber}` : ""}</td>
                <td>
                  <Link href={`/workspace/documents/${row.id}`} className="underline">
                    {row.title}
                  </Link>
                  {row.overdue || row.taskOverdue ? <span className="ml-2 text-red-600">{t("overdue")}</span> : null}
                </td>
                <td>{t(`status_${row.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="mt-2 text-sm">{t("empty")}</p> : null}
      </div>
    </div>
  );
}
