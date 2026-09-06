"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import {
  TemplateResultForm,
  type ResultLineState,
} from "@/components/TemplateResultForm";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";
import type { DiagnosticCatalogItem, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { buildCpoePayloadSnapshot } from "@/domain/cpoe/cpoe-payload";

type CpoeRow = {
  id: string;
  templateId: string | null;
  payloadJson: string;
  createdAt: string;
};

type Props = {
  visitId: string;
};

export function VisitCpoePanel({ visitId }: Props) {
  const t = useTranslations("visits");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [templates, setTemplates] = useState<DiagnosticCatalogItem[]>([]);
  const [templateCode, setTemplateCode] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<ResultLineState[]>([]);
  const [entries, setEntries] = useState<CpoeRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printHref, setPrintHref] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const selected = useMemo(
    () => templates.find((x) => x.code === templateCode) ?? null,
    [templates, templateCode],
  );

  const loadEntries = useCallback(async () => {
    const res = await fetch(`/api/visits/${visitId}/cpoe`);
    if (!res.ok) return;
    const json = await res.json();
    const items = (json.data?.items ?? json.items ?? []) as CpoeRow[];
    setEntries(Array.isArray(items) ? items : []);
  }, [visitId]);

  useEffect(() => {
    void fetch("/api/diagnostic-catalog?kinds=visit&applyFavorites=false")
      .then((r) => r.json())
      .then((raw) => {
        const data = (raw.data ?? raw) as { items?: DiagnosticCatalogItem[] };
        const items = data.items ?? [];
        setTemplates(Array.isArray(items) ? items : []);
      });
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    setFieldValues({});
    setMetaValues({});
    setLines([]);
  }, [templateCode]);

  async function save() {
    if (!selected) {
      setMsg(t("cpoePickTemplate"));
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const payload = buildCpoePayloadSnapshot({
        item: selected,
        fieldValues,
        metaValues,
        lines,
      });
      const res = await fetch(`/api/visits/${visitId}/cpoe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.code,
          payloadJson: JSON.stringify(payload),
        }),
      });
      if (!res.ok) {
        setMsg(tc("saveFailed"));
        return;
      }
      setMsg(t("cpoeSaved"));
      await loadEntries();
    } finally {
      setSaving(false);
    }
  }

  const options = templates.map((tpl) => ({
    value: tpl.code,
    label: `${tpl.code} · ${pickL10n(tpl.title as L10n, locale)}`,
  }));

  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">{t("cpoeTitle")}</h3>
      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("cpoeSubtitle")}</p>
      <CatalogField
        kind="SEARCHABLE"
        label={t("cpoeTemplate")}
        value={templateCode}
        onChange={(v) => setTemplateCode(String(v))}
        options={options}
        emptyLabel="—"
      />
      {selected ? (
        <TemplateResultForm
          item={selected}
          metaFields={[]}
          metaValues={metaValues}
          onMetaChange={(key, value) => setMetaValues((prev) => ({ ...prev, [key]: value }))}
          lines={lines}
          onLinesChange={setLines}
          fieldValues={fieldValues}
          onFieldChange={(key, value) => setFieldValues((prev) => ({ ...prev, [key]: value }))}
          labels={{
            meta: t("cpoeMeta"),
            fields: t("cpoeFields"),
            analytes: t("cpoeAnalytes"),
            value: tc("value"),
            noTemplate: t("cpoeNoFields"),
          }}
        />
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving || !selected}
          onClick={() => void save()}
        >
          {tc("save")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void loadEntries()}>
          {t("cpoeRefresh")}
        </button>
      </div>
      {msg ? <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
      {entries.length > 0 ? (
        <ul className="space-y-1 text-[12px]">
          {entries.map((e) => (
            <li
              key={e.id}
              className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${TEXT_MUTED_CLASS}`}
            >
              <span>
                {new Date(e.createdAt).toLocaleString()} · {e.templateId ?? "—"}
              </span>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setPrintHref(`/print/visit-exam/${e.id}`);
                  setPrintOpen(true);
                }}
              >
                {t("cpoePrint")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("cpoeEmptyHistory")}</p>
      )}
      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
        title={t("cpoePrint")}
      />
    </div>
  );
}
