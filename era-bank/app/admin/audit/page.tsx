"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";

type AuditRow = {
  id: string;
  action: string;
  refType?: string | null;
  refId?: string | null;
  at: string;
  opsUser: string;
  fullName: string;
};

export default function OpsAuditPage() {
  const t = useTranslations("pages.audit");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/audit", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setError(`${tCommon("error")} (${res.status})`);
          return;
        }
        setRows((await res.json()) as AuditRow[]);
      })
      .catch(() => setError(tCommon("error")));
  }, [tCommon]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className={CARD_CONTAINER_CLASS}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2">{t("time")}</th>
                <th className="px-3 py-2">{t("user")}</th>
                <th className="px-3 py-2">{t("action")}</th>
                <th className="px-3 py-2">{t("ref")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-3 py-2">{new Date(row.at).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2 font-mono">{row.action}</td>
                  <td className="px-3 py-2">
                    {row.refType ?? "—"} {row.refId ? `/ ${row.refId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
