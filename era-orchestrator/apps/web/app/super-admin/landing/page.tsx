"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

type LandingModule = {
  moduleSlug: string;
  sortOrder?: number;
  names?: { az?: string; ru?: string; en?: string };
  descriptions?: { az?: string; ru?: string; en?: string };
  tasks?: { az?: string[]; ru?: string[]; en?: string[] };
};

export default function SuperAdminLandingPage() {
  const t = useTranslations("superAdmin.landing");
  const [items, setItems] = useState<LandingModule[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [nameAz, setNameAz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [descAz, setDescAz] = useState("");
  const [descRu, setDescRu] = useState("");
  const [tasksAz, setTasksAz] = useState("");
  const [tasksRu, setTasksRu] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await cpAdminFetch("landing-modules");
    if (!res.ok) {
      setError(t("loadFailed"));
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as LandingModule[];
    const list = Array.isArray(data) ? data : [];
    setItems(list);
    setLoading(false);
    return list;
  }, [t]);

  function selectModule(m: LandingModule) {
    setSelected(m.moduleSlug);
    setNameAz(m.names?.az ?? "");
    setNameRu(m.names?.ru ?? "");
    setDescAz(m.descriptions?.az ?? "");
    setDescRu(m.descriptions?.ru ?? "");
    setTasksAz((m.tasks?.az ?? []).join("\n"));
    setTasksRu((m.tasks?.ru ?? []).join("\n"));
    setSortOrder(String(m.sortOrder ?? 0));
  }

  useEffect(() => {
    void load().then((list) => {
      if (list?.[0]) selectModule(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount load once
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch(`landing-modules/${encodeURIComponent(selected)}`, {
        method: "PATCH",
        body: JSON.stringify({
          sortOrder: Number(sortOrder) || 0,
          names: { az: nameAz, ru: nameRu },
          descriptions: { az: descAz, ru: descRu },
          tasks: {
            az: tasksAz.split("\n").map((s) => s.trim()).filter(Boolean),
            ru: tasksRu.split("\n").map((s) => s.trim()).filter(Boolean),
          },
        }),
      });
      if (!res.ok) {
        setError(t("saveFailed"));
        return;
      }
      setMsg(t("saveOk"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className={CARD_CONTAINER_CLASS}>
          <ul className="divide-y divide-[#EBEDF0]">
            {items.map((m) => (
              <li key={m.moduleSlug}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm ${
                    selected === m.moduleSlug
                      ? "bg-[#EBF5FB] font-medium text-[#2980B9]"
                      : "text-[#34495E]"
                  }`}
                  onClick={() => selectModule(m)}
                >
                  {m.moduleSlug}
                </button>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="p-3 text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        </div>

        {selected ? (
          <form onSubmit={(e) => void save(e)} className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <p className="text-sm font-semibold text-[#34495E]">{selected}</p>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("sortOrder")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1`}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("nameAz")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1`}
                value={nameAz}
                onChange={(e) => setNameAz(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("nameRu")}
              <input
                className={`${MODAL_INPUT_CLASS} mt-1`}
                value={nameRu}
                onChange={(e) => setNameRu(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("descAz")}
              <textarea
                className={`${MODAL_INPUT_CLASS} mt-1 min-h-[4rem]`}
                value={descAz}
                onChange={(e) => setDescAz(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("descRu")}
              <textarea
                className={`${MODAL_INPUT_CLASS} mt-1 min-h-[4rem]`}
                value={descRu}
                onChange={(e) => setDescRu(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("tasksAz")}
              <textarea
                className={`${MODAL_INPUT_CLASS} mt-1 min-h-[4rem]`}
                value={tasksAz}
                onChange={(e) => setTasksAz(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-[#7F8C8D]">
              {t("tasksRu")}
              <textarea
                className={`${MODAL_INPUT_CLASS} mt-1 min-h-[4rem]`}
                value={tasksRu}
                onChange={(e) => setTasksRu(e.target.value)}
              />
            </label>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {t("save")}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
