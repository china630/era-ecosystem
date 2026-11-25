"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Stage = {
  id: string;
  name: string;
  sortOrder: number;
  color?: string | null;
  kind: "OPEN" | "WON" | "LOST";
};

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
  _count?: { leads: number };
};

type PipelineRule = {
  id: string;
  name: string;
  triggerType: string;
  actionJson: string;
};

const KIND_OPTIONS = [
  { value: "OPEN", label: "OPEN" },
  { value: "WON", label: "WON" },
  { value: "LOST", label: "LOST" },
];

export default function AdminPipelinesPage() {
  const t = useTranslations("adminPipelines");
  const tc = useTranslations("common");
  const [items, setItems] = useState<Pipeline[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageKind, setStageKind] = useState<"OPEN" | "WON" | "LOST">("OPEN");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<PipelineRule[]>([]);
  const [ruleId, setRuleId] = useState("");
  const [autoReply, setAutoReply] = useState("");

  const load = useCallback(async () => {
    const [pipeRes, rulesRes] = await Promise.all([
      fetch("/api/pipelines"),
      fetch("/api/pipeline/rules"),
    ]);
    const json = (await pipeRes.json()) as { items?: Pipeline[]; error?: string };
    if (!pipeRes.ok) {
      setError(json.error ?? t("loadFailed"));
      return;
    }
    setItems(json.items ?? []);
    if (!activeId && json.items?.[0]) setActiveId(json.items[0].id);
    if (rulesRes.ok) {
      const rulesJson = (await rulesRes.json()) as { rules?: PipelineRule[] };
      const list = rulesJson.rules ?? [];
      setRules(list);
      if (!ruleId && list[0]) {
        setRuleId(list[0].id);
        try {
          const actions = JSON.parse(list[0].actionJson || "{}") as {
            autoReply?: string;
          };
          setAutoReply(actions.autoReply ?? "");
        } catch {
          setAutoReply("");
        }
      }
    }
    setError("");
  }, [activeId, ruleId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = items.find((p) => p.id === activeId) ?? null;

  async function createPipeline() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isDefault: items.length === 0 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      setName("");
      setActiveId(json.id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/pipelines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? t("saveFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addStage() {
    if (!activeId || !stageName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pipelines/${activeId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: stageName.trim(), kind: stageKind }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      setStageName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function pickRule(id: string) {
    setRuleId(id);
    const row = rules.find((r) => r.id === id);
    if (!row) {
      setAutoReply("");
      return;
    }
    try {
      const actions = JSON.parse(row.actionJson || "{}") as { autoReply?: string };
      setAutoReply(actions.autoReply ?? "");
    } catch {
      setAutoReply("");
    }
  }

  async function saveAutoReply() {
    if (!ruleId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pipeline/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionJson: { autoReply: autoReply.trim() } }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function seedTemplate(vertical: "clinic" | "hotel" | "construction") {
    setBusy(true);
    try {
      const res = await fetch(`/api/pipelines/templates/${vertical}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("saveFailed"));
        return;
      }
      if (json.id) setActiveId(json.id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeStage(stageId: string) {
    if (!activeId) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/pipelines/${activeId}/stages/${stageId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.code === "has_leads" ? t("stageHasLeads") : (json.error ?? t("saveFailed")),
        );
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("verticalTemplates")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("verticalTemplatesHint")}</p>
        <div className="flex flex-wrap gap-2">
          {(["clinic", "hotel", "construction"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void seedTemplate(v)}
            >
              {t(`vertical_${v}`)}
            </button>
          ))}
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("botLiteTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("botLiteHint")}</p>
        {rules.length === 0 ? (
          <p className="text-sm text-[#7F8C8D]">{t("botLiteEmpty")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <CatalogField
              kind="CLOSED_MEDIUM"
              label={t("botLiteRule")}
              value={ruleId}
              onChange={(v) => pickRule(String(v))}
              options={rules.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.triggerType})`,
              }))}
            />
            <Field
              label={t("botLiteAutoReply")}
              preset="longText"
              value={autoReply}
              onChange={(e) => setAutoReply(e.target.value)}
            />
          </div>
        )}
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !ruleId}
          onClick={() => void saveAutoReply()}
        >
          {t("botLiteSave")}
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("createPipeline")}</h2>
        <div className="flex flex-wrap gap-2">
          <Field
            label={t("pipelineName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !name.trim()}
            onClick={() => void createPipeline()}
          >
            {tc("save")}
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-12">
        <aside className={`md:col-span-4 ${CARD_CONTAINER_CLASS} space-y-2 p-3`}>
          <h2 className="mb-2 font-medium">{t("listTitle")}</h2>
          <ul className="space-y-1">
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full rounded border px-2 py-2 text-left text-sm ${
                    activeId === p.id ? "border-[var(--era-accent)]" : ""
                  }`}
                  onClick={() => setActiveId(p.id)}
                >
                  {p.name}
                  {p.isDefault ? ` · ${t("defaultBadge")}` : ""}
                  <span className="block text-xs text-[#7F8C8D]">
                    {t("leadCount", { count: p._count?.leads ?? 0 })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={`md:col-span-8 ${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium">{active.name}</h2>
                {!active.isDefault ? (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void setDefault(active.id)}
                  >
                    {t("makeDefault")}
                  </button>
                ) : (
                  <span className="text-xs text-[#7F8C8D]">{t("defaultBadge")}</span>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                {active.stages.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEFF1] pb-2"
                  >
                    <span>
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ background: s.color || "#7F8C8D" }}
                      />
                      {s.sortOrder}. {s.name}{" "}
                      <span className="text-xs text-[#7F8C8D]">({s.kind})</span>
                    </span>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={busy}
                      onClick={() => void removeStage(s.id)}
                    >
                      {t("deleteStage")}
                    </button>
                  </li>
                ))}
                {!active.stages.length ? (
                  <li className="text-[#7F8C8D]">{t("noStages")}</li>
                ) : null}
              </ul>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field
                  label={t("stageName")}
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                />
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("stageKind")}
                  value={stageKind}
                  onChange={(v) =>
                    setStageKind(
                      (String(v) as "OPEN" | "WON" | "LOST") || "OPEN",
                    )
                  }
                  options={KIND_OPTIONS}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy || !stageName.trim()}
                    onClick={() => void addStage()}
                  >
                    {t("addStage")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("pickPipeline")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
