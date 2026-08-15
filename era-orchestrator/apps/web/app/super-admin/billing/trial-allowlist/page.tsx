"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../lib/auth-context";
import { orchFetch } from "../../../../lib/orch-api";

type AllowlistModule = {
  key: string;
  name: string;
  satelliteKey: string | null;
  trialEligibleInTrial: boolean;
};

type AllowlistGroup = {
  groupKey: string;
  groupName: string;
  modules: AllowlistModule[];
};

export default function TrialAllowlistPage() {
  const t = useTranslations("superAdmin.trialAllowlist");
  const { token } = useAuth();
  const [groups, setGroups] = useState<AllowlistGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await orchFetch("/v1/admin/config/trial-allowlist", { token });
      if (!res.ok) return;
      const data = (await res.json()) as AllowlistGroup[];
      setGroups(data);
      const next = new Set<string>();
      for (const g of data) {
        for (const row of g.modules) {
          if (row.trialEligibleInTrial) next.add(row.key);
        }
      }
      setSelected(next);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      await orchFetch("/v1/admin/config/trial-allowlist", {
        token,
        method: "PATCH",
        body: JSON.stringify({ moduleKeys: [...selected] }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(group: AllowlistGroup, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of group.modules) {
        if (on) next.add(m.key);
        else next.delete(m.key);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#34495E]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {!loading ? (
        <>
          {groups.map((group) => {
            const allOn =
              group.modules.length > 0 &&
              group.modules.every((m) => selected.has(m.key));
            return (
              <section key={group.groupKey} className={`${CARD_CONTAINER_CLASS} p-4`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#34495E]">
                    {group.groupName}
                    <span className="ml-2 font-mono text-xs font-normal text-[#95A5A6]">
                      {group.groupKey}
                    </span>
                  </h2>
                  {group.modules.length > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-[#2980B9] hover:underline"
                      onClick={() => toggleGroup(group, !allOn)}
                    >
                      {allOn ? t("deselectAll") : t("selectAll")}
                    </button>
                  ) : (
                    <span className="text-xs text-[#95A5A6]">{t("noModules")}</span>
                  )}
                </div>
                {group.modules.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {group.modules.map((row) => (
                      <li key={row.key}>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected.has(row.key)}
                            onChange={() => toggle(row.key)}
                          />
                          <span>
                            {row.name}{" "}
                            <span className="text-[#7F8C8D]">({row.key})</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t("saving") : t("save")}
          </button>
        </>
      ) : null}
    </div>
  );
}
