"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PageHeader } from "@era/satellite-kit/ui";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  userId?: string | null;
};

export default function ClinicAuditPage() {
  const t = useTranslations("audit");
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    void fetch("/api/audit?limit=100")
      .then((r) => r.json())
      .then((d) => setRows((d.data ?? d) as AuditRow[]));
  }, []);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b text-[#7F8C8D]">
              <th className="p-2">{t("when")}</th>
              <th className="p-2">{t("entity")}</th>
              <th className="p-2">{t("action")}</th>
              <th className="p-2">{t("user")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2">
                  {r.entityType} / {r.entityId.slice(0, 8)}
                </td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">{r.userId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
