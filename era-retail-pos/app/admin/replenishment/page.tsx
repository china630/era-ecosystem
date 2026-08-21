"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Suggestion = {
  sku?: string;
  suggestedQty?: number;
};

export default function ReplenishmentPage() {
  const t = useTranslations("admin.replenishment");
  const [data, setData] = useState<{ suggestions?: unknown[] } | null>(null);

  useEffect(() => {
    fetch("/api/replenishment/suggestions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ suggestions: [] }));
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/admin/supplier-match" className={SECONDARY_BUTTON_CLASS}>
            {t("supplierMatch")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mt-4 overflow-hidden`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
              <th className="p-3">{t("sku")}</th>
              <th className="p-3">{t("suggestedQty")}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.suggestions as Suggestion[] | undefined)?.map((s, i) => (
              <tr key={`${s.sku ?? "row"}-${i}`} className="border-b border-[#EBEDF0] last:border-b-0">
                <td className="p-3 font-medium">{s.sku ?? t("unknownSku")}</td>
                <td className="p-3">{s.suggestedQty ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.suggestions?.length && (
          <p className="p-3 text-sm text-[#7F8C8D]">{t("empty")}</p>
        )}
      </div>
    </main>
  );
}
