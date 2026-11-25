"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";

type UnsortedLead = {
  id: string;
  title: string;
  contactRef: string;
  contactPhone?: string | null;
  channel: string;
  sourceRef?: string | null;
  stage: string;
  createdAt: string;
};

export default function UnsortedPage() {
  const t = useTranslations("unsorted");
  const tc = useTranslations("common");
  const [items, setItems] = useState<UnsortedLead[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/unsorted");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? tc("failed"));
      return;
    }
    setItems(json.items ?? []);
    setError("");
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, path: string, body?: object) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/unsorted/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? tc("failed"));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/leads" className={SECONDARY_BUTTON_CLASS}>
            {t("pipeline")}
          </Link>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {items.length === 0 ? (
        <p className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((lead) => (
            <li key={lead.id} className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-[#2C3E50] underline-offset-2 hover:underline"
                  >
                    {lead.title}
                  </Link>
                  <p className="text-xs text-[#7F8C8D]">
                    {lead.contactPhone || lead.contactRef} · {lead.channel}
                    {lead.sourceRef ? ` · ${lead.sourceRef}` : ""}
                  </p>
                  <p className="text-xs text-[#7F8C8D]">
                    {bakuDateTimeDisplay(lead.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busyId === lead.id}
                    onClick={() => void act(lead.id, "accept")}
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busyId === lead.id}
                    onClick={() => void act(lead.id, "reject")}
                  >
                    {t("reject")}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field
                  label={t("linkTarget")}
                  preset="shortText"
                  value={linkTarget[lead.id] ?? ""}
                  onChange={(e) =>
                    setLinkTarget((prev) => ({
                      ...prev,
                      [lead.id]: e.target.value,
                    }))
                  }
                  placeholder={t("linkTargetPlaceholder")}
                />
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={busyId === lead.id || !(linkTarget[lead.id] ?? "").trim()}
                  onClick={() =>
                    void act(lead.id, "link", {
                      targetLeadId: (linkTarget[lead.id] ?? "").trim(),
                    })
                  }
                >
                  {t("link")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
