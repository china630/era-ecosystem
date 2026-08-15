"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

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
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("when")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("entity")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("action")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("user")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{new Date(r.createdAt).toLocaleString()}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {r.entityType} / {r.entityId.slice(0, 8)}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{r.action}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.userId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
