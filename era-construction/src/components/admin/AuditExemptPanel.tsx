"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Payload = {
  prefixes: string[];
  usingDefault: boolean;
  defaults: string[];
};

export function AuditExemptPanel() {
  const t = useTranslations("auditExempt");
  const [text, setText] = useState("");
  const [usingDefault, setUsingDefault] = useState(true);
  const [defaults, setDefaults] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/admin/audit-exempt")
      .then(async (res) => {
        const body = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(body.error ?? t("loadFailed"));
        setUsingDefault(body.usingDefault);
        setDefaults(body.defaults ?? []);
        setText((body.usingDefault ? body.defaults : body.prefixes).join("\n"));
      })
      .catch((err: unknown) => showApiError(err));
  }, [t]);

  async function save() {
    const prefixes = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const res = await fetch("/api/admin/audit-exempt", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefixes }),
    });
    const body = (await res.json()) as Payload & { error?: string };
    if (!res.ok) {
      showApiError(new Error(body.error ?? t("saveFailed")));
      return;
    }
    setUsingDefault(body.usingDefault);
    setText((body.usingDefault ? body.defaults : body.prefixes).join("\n"));
    showSuccess(t("saved"));
  }

  return (
    <section className={`${CARD_CONTAINER_CLASS} mt-6 p-4`}>
      <h2 className="text-base font-semibold">{t("title")}</h2>
      <p className={`${TEXT_MUTED_CLASS} mt-1 text-sm`}>{t("hint")}</p>
      {usingDefault ? <p className="mt-2 text-sm">{t("usingDefault")}</p> : null}
      <textarea
        className="mt-3 w-full rounded border border-[#D5DADF] p-2 font-mono text-sm"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={t("title")}
      />
      <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-3`} onClick={() => void save()}>
        {t("save")}
      </button>
    </section>
  );
}
