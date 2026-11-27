"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "@/lib/cp-admin-fetch";

type LocaleMap = { az?: string; ru?: string; en?: string };

type SatRow = {
  satelliteKey: string;
  commercialName: string;
  verticalSlug: string;
  hasProfile: boolean;
  hasPublicContent: boolean;
  onVitrine: boolean;
  profile: {
    publicSlug: string;
    visibility: string;
    maturity: string;
    sortOrder: number;
    kind: string;
    showOnSite: boolean;
    names: LocaleMap;
    descriptions: LocaleMap;
    tagline: LocaleMap;
    body: LocaleMap;
    imageUrl: string | null;
  } | null;
};

type ModRow = {
  moduleKey: string;
  commercialName: string;
  satelliteKey: string | null;
  hasProfile: boolean;
  profile: {
    visibility: string;
    maturity: string | null;
    sortOrder: number;
    showAsSubsection: boolean;
    names: LocaleMap;
    descriptions: LocaleMap;
  } | null;
};

type IndustryItem = {
  satelliteKey: string;
  moduleKey: string;
  role: "C" | "I" | "O";
  assumed: boolean;
  sortOrder: number;
};

type IndustryRow = {
  slug: string;
  visibility: string;
  maturityOverride: string | null;
  sortOrder: number;
  names: LocaleMap;
  descriptions: LocaleMap;
  items: IndustryItem[];
};

type CommercialKeys = {
  satellites: Array<{ key: string; name: string }>;
  modules: Array<{ key: string; name: string; satelliteKey: string | null }>;
};

type SiteConfigRow = {
  key: string;
  description: string;
  valueKind: string;
  allowPut: boolean;
  storedValue: unknown;
  effectiveValue: unknown;
};

type EdgeRow = {
  id: string;
  fromKey: string;
  toKey: string;
  kind: string;
  realizationStatus: "live" | "partial" | "planned";
  visibility: string;
  sortOrder: number;
  autoManaged: boolean;
  labels: LocaleMap;
};

type Tab = "products" | "modules" | "industries" | "edges" | "settings";

function asMap(v: unknown): LocaleMap {
  if (!v || typeof v !== "object") return {};
  return v as LocaleMap;
}

export default function SiteCatalogAdminPage() {
  const t = useTranslations("superAdmin.siteCatalog");
  const [tab, setTab] = useState<Tab>("products");
  const [sats, setSats] = useState<SatRow[]>([]);
  const [mods, setMods] = useState<ModRow[]>([]);
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [keys, setKeys] = useState<CommercialKeys>({ satellites: [], modules: [] });
  const [settings, setSettings] = useState<SiteConfigRow[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [selectedSat, setSelectedSat] = useState("");
  const [selectedMod, setSelectedMod] = useState("");
  const [selectedInd, setSelectedInd] = useState("");
  const [selectedEdge, setSelectedEdge] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [edgeStatus, setEdgeStatus] = useState<"live" | "partial" | "planned">(
    "planned",
  );
  const [edgeVis, setEdgeVis] = useState("VISIBLE");
  const [edgeSort, setEdgeSort] = useState("0");
  const [edgeLabelAz, setEdgeLabelAz] = useState("");
  const [edgeLabelRu, setEdgeLabelRu] = useState("");
  const [edgeLabelEn, setEdgeLabelEn] = useState("");
  const [edgeAuto, setEdgeAuto] = useState(false);

  // Product form
  const [publicSlug, setPublicSlug] = useState("");
  const [visibility, setVisibility] = useState("DRAFT");
  const [maturity, setMaturity] = useState("prod");
  const [sortOrder, setSortOrder] = useState("0");
  const [kind, setKind] = useState("industry");
  const [showOnSite, setShowOnSite] = useState(false);
  const [nameAz, setNameAz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAz, setDescAz] = useState("");
  const [descRu, setDescRu] = useState("");
  const [descEn, setDescEn] = useState("");
  const [tagAz, setTagAz] = useState("");
  const [tagRu, setTagRu] = useState("");
  const [tagEn, setTagEn] = useState("");
  const [bodyAz, setBodyAz] = useState("");
  const [bodyRu, setBodyRu] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Module form
  const [modVis, setModVis] = useState("VISIBLE");
  const [modMat, setModMat] = useState("");
  const [modSort, setModSort] = useState("0");
  const [modNameAz, setModNameAz] = useState("");
  const [modNameRu, setModNameRu] = useState("");
  const [modNameEn, setModNameEn] = useState("");
  const [modDescAz, setModDescAz] = useState("");
  const [modDescRu, setModDescRu] = useState("");
  const [modDescEn, setModDescEn] = useState("");
  const [modSubsection, setModSubsection] = useState(true);

  // Industry form
  const [indNames, setIndNames] = useState<LocaleMap>({});
  const [indDescs, setIndDescs] = useState<LocaleMap>({});
  const [indVis, setIndVis] = useState("VISIBLE");
  const [indSort, setIndSort] = useState("0");
  const [indItems, setIndItems] = useState<IndustryItem[]>([]);
  const [newIndSlug, setNewIndSlug] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, mRes, iRes, kRes, cRes, eRes] = await Promise.all([
        cpAdminFetch("site-catalog/satellites"),
        cpAdminFetch("site-catalog/modules"),
        cpAdminFetch("site-catalog/industries"),
        cpAdminFetch("site-catalog/commercial-keys"),
        cpAdminFetch("system-config"),
        cpAdminFetch("site-catalog/edges"),
      ]);
      if (!sRes.ok || !mRes.ok || !iRes.ok) {
        setError(t("loadFailed"));
        return;
      }
      const sData = (await sRes.json()) as SatRow[];
      const mData = (await mRes.json()) as ModRow[];
      const iData = (await iRes.json()) as IndustryRow[];
      const kData = kRes.ok
        ? ((await kRes.json()) as CommercialKeys)
        : { satellites: [], modules: [] };
      const cData = cRes.ok ? ((await cRes.json()) as SiteConfigRow[]) : [];
      const eData = eRes.ok ? ((await eRes.json()) as EdgeRow[]) : [];
      setSats(Array.isArray(sData) ? sData : []);
      setMods(Array.isArray(mData) ? mData : []);
      setIndustries(Array.isArray(iData) ? iData : []);
      setKeys(kData);
      setSettings(
        Array.isArray(cData)
          ? cData.filter((r) => r.key.startsWith("site."))
          : [],
      );
      setEdges(Array.isArray(eData) ? eData : []);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sat = useMemo(
    () => sats.find((s) => s.satelliteKey === selectedSat) ?? null,
    [sats, selectedSat],
  );
  const mod = useMemo(
    () => mods.find((m) => m.moduleKey === selectedMod) ?? null,
    [mods, selectedMod],
  );
  const ind = useMemo(
    () => industries.find((i) => i.slug === selectedInd) ?? null,
    [industries, selectedInd],
  );
  const edge = useMemo(
    () => edges.find((e) => e.id === selectedEdge) ?? null,
    [edges, selectedEdge],
  );

  function selectEdge(row: EdgeRow) {
    setSelectedEdge(row.id);
    setEdgeStatus(row.realizationStatus);
    setEdgeVis(row.visibility);
    setEdgeSort(String(row.sortOrder ?? 0));
    const labels = asMap(row.labels);
    setEdgeLabelAz(labels.az ?? "");
    setEdgeLabelRu(labels.ru ?? "");
    setEdgeLabelEn(labels.en ?? "");
    setEdgeAuto(Boolean(row.autoManaged));
  }

  async function saveEdge(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEdge) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch(
        `site-catalog/edges/${encodeURIComponent(selectedEdge)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            realizationStatus: edgeStatus,
            visibility: edgeVis,
            sortOrder: Number(edgeSort) || 0,
            autoManaged: edgeAuto,
            labels: {
              az: edgeLabelAz.trim() || undefined,
              ru: edgeLabelRu.trim() || undefined,
              en: edgeLabelEn.trim() || undefined,
            },
          }),
        },
      );
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

  function selectSat(row: SatRow) {
    setSelectedSat(row.satelliteKey);
    setPublicSlug(row.profile?.publicSlug ?? row.verticalSlug);
    setVisibility(row.profile?.visibility ?? "DRAFT");
    setMaturity(row.profile?.maturity ?? "prod");
    setSortOrder(String(row.profile?.sortOrder ?? 0));
    setKind(row.profile?.kind ?? "industry");
    setShowOnSite(row.profile?.showOnSite ?? false);
    const n = asMap(row.profile?.names);
    const d = asMap(row.profile?.descriptions);
    const tg = asMap(row.profile?.tagline);
    const bd = asMap(row.profile?.body);
    setNameAz(n.az ?? row.commercialName);
    setNameRu(n.ru ?? row.commercialName);
    setNameEn(n.en ?? row.commercialName);
    setDescAz(d.az ?? "");
    setDescRu(d.ru ?? "");
    setDescEn(d.en ?? "");
    setTagAz(tg.az ?? "");
    setTagRu(tg.ru ?? "");
    setTagEn(tg.en ?? "");
    setBodyAz(bd.az ?? "");
    setBodyRu(bd.ru ?? "");
    setBodyEn(bd.en ?? "");
    setImageUrl(row.profile?.imageUrl ?? "");
  }

  function selectMod(row: ModRow) {
    setSelectedMod(row.moduleKey);
    setModVis(row.profile?.visibility ?? "VISIBLE");
    setModMat(row.profile?.maturity ?? "");
    setModSort(String(row.profile?.sortOrder ?? 0));
    setModSubsection(row.profile?.showAsSubsection ?? true);
    const n = asMap(row.profile?.names);
    const d = asMap(row.profile?.descriptions);
    setModNameAz(n.az ?? row.commercialName);
    setModNameRu(n.ru ?? row.commercialName);
    setModNameEn(n.en ?? row.commercialName);
    setModDescAz(d.az ?? "");
    setModDescRu(d.ru ?? "");
    setModDescEn(d.en ?? "");
  }

  function selectInd(row: IndustryRow) {
    setSelectedInd(row.slug);
    setIndNames(asMap(row.names));
    setIndDescs(asMap(row.descriptions));
    setIndVis(row.visibility);
    setIndSort(String(row.sortOrder));
    setIndItems(
      row.items.map((it) => ({
        satelliteKey: it.satelliteKey,
        moduleKey: it.moduleKey || "",
        role: it.role,
        assumed: it.assumed,
        sortOrder: it.sortOrder,
      })),
    );
  }

  async function saveSat(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSat) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch(
        `site-catalog/satellites/${encodeURIComponent(selectedSat)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            publicSlug,
            visibility,
            maturity,
            sortOrder: Number(sortOrder) || 0,
            kind,
            showOnSite,
            names: { az: nameAz, ru: nameRu, en: nameEn },
            descriptions: { az: descAz, ru: descRu, en: descEn },
            tagline: { az: tagAz, ru: tagRu, en: tagEn },
            body: { az: bodyAz, ru: bodyRu, en: bodyEn },
            imageUrl: imageUrl.trim() || null,
          }),
        },
      );
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

  async function saveMod(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMod) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch(
        `site-catalog/modules/${encodeURIComponent(selectedMod)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            visibility: modVis,
            maturity: modMat || null,
            sortOrder: Number(modSort) || 0,
            showAsSubsection: modSubsection,
            names: { az: modNameAz, ru: modNameRu, en: modNameEn },
            descriptions: { az: modDescAz, ru: modDescRu, en: modDescEn },
          }),
        },
      );
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

  async function saveInd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInd) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch(
        `site-catalog/industries/${encodeURIComponent(selectedInd)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            visibility: indVis,
            sortOrder: Number(indSort) || 0,
            names: indNames,
            descriptions: indDescs,
            items: indItems.map((it, idx) => ({
              ...it,
              sortOrder: it.sortOrder || idx + 1,
            })),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : t("saveFailed"),
        );
        return;
      }
      setMsg(t("saveOk"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createInd() {
    const slug = newIndSlug.trim().toLowerCase();
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const res = await cpAdminFetch("site-catalog/industries", {
        method: "POST",
        body: JSON.stringify({
          slug,
          names: { az: slug, ru: slug, en: slug },
          visibility: "DRAFT",
          items: [],
        }),
      });
      if (!res.ok) {
        setError(t("saveFailed"));
        return;
      }
      setNewIndSlug("");
      setMsg(t("saveOk"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveSetting(key: string, value: unknown) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await cpAdminFetch(`system-config/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
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

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "products", label: t("tabProducts") },
    { id: "modules", label: t("tabModules") },
    { id: "industries", label: t("tabIndustries") },
    { id: "edges", label: t("tabEdges") },
    { id: "settings", label: t("tabSettings") },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={
              tab === tb.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS
            }
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className={CARD_CONTAINER_CLASS}>
            <ul className="max-h-[70vh] divide-y divide-[#EBEDF0] overflow-auto">
              {sats.map((row) => (
                <li key={row.satelliteKey}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${
                      selectedSat === row.satelliteKey
                        ? "bg-[#EBF5FB] font-medium text-[#2980B9]"
                        : "text-[#34495E]"
                    }`}
                    onClick={() => selectSat(row)}
                  >
                    <span className="block">{row.commercialName}</span>
                    <span className="block text-xs text-[#7F8C8D]">
                      {row.satelliteKey}
                      {row.onVitrine
                        ? ` · ${t("onVitrine")}`
                        : row.hasProfile
                          ? ` · ${t("configured")}`
                          : ` · ${t("needsSetup")}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {sat ? (
            <form
              onSubmit={(e) => void saveSat(e)}
              className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
            >
              <p className="text-sm font-semibold text-[#34495E]">
                {sat.satelliteKey}
              </p>
              <p className="text-xs text-[#7F8C8D]">{t("pickOnlyHint")}</p>
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("publicSlug")}
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={publicSlug}
                  onChange={(e) => setPublicSlug(e.target.value)}
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-[#7F8C8D]">
                  {t("visibility")}
                  <select
                    className={`${MODAL_INPUT_CLASS} mt-1`}
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                  >
                    <option value="VISIBLE">VISIBLE</option>
                    <option value="HIDDEN">HIDDEN</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-[#7F8C8D]">
                  {t("maturity")}
                  <select
                    className={`${MODAL_INPUT_CLASS} mt-1`}
                    value={maturity}
                    onChange={(e) => setMaturity(e.target.value)}
                  >
                    <option value="prod">prod</option>
                    <option value="pilot">pilot</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-[#7F8C8D]">
                  {t("sortOrder")}
                  <input
                    className={`${MODAL_INPUT_CLASS} mt-1`}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#34495E]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={showOnSite}
                  onChange={(e) => setShowOnSite(e.target.checked)}
                />
                {t("showOnSite")}
              </label>
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("kind")}
                <select
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="core">core</option>
                  <option value="industry">industry</option>
                  <option value="platform">platform</option>
                </select>
              </label>
              {(
                [
                  ["az", nameAz, setNameAz, descAz, setDescAz, tagAz, setTagAz, bodyAz, setBodyAz],
                  ["ru", nameRu, setNameRu, descRu, setDescRu, tagRu, setTagRu, bodyRu, setBodyRu],
                  ["en", nameEn, setNameEn, descEn, setDescEn, tagEn, setTagEn, bodyEn, setBodyEn],
                ] as const
              ).map(([loc, n, sn, d, sd, tg, stg, bd, sbd]) => (
                <div key={loc} className="space-y-2 border-t border-[#EBEDF0] pt-3">
                  <p className="text-xs font-semibold uppercase text-[#7F8C8D]">
                    {loc}
                  </p>
                  <input
                    className={MODAL_INPUT_CLASS}
                    value={n}
                    onChange={(e) => sn(e.target.value)}
                    placeholder={t("name")}
                  />
                  <input
                    className={MODAL_INPUT_CLASS}
                    value={tg}
                    onChange={(e) => stg(e.target.value)}
                    placeholder={t("tagline")}
                  />
                  <textarea
                    className={`${MODAL_INPUT_CLASS} min-h-[3.5rem]`}
                    value={d}
                    onChange={(e) => sd(e.target.value)}
                    placeholder={t("description")}
                  />
                  <textarea
                    className={`${MODAL_INPUT_CLASS} min-h-[4.5rem]`}
                    value={bd}
                    onChange={(e) => sbd(e.target.value)}
                    placeholder={t("body")}
                  />
                </div>
              ))}
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("imageUrl")}
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://"
                />
              </label>
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {t("save")}
              </button>
            </form>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("selectProduct")}</p>
          )}
        </div>
      ) : null}

      {tab === "modules" ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className={CARD_CONTAINER_CLASS}>
            <ul className="max-h-[70vh] divide-y divide-[#EBEDF0] overflow-auto">
              {mods.map((row) => (
                <li key={row.moduleKey}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${
                      selectedMod === row.moduleKey
                        ? "bg-[#EBF5FB] font-medium text-[#2980B9]"
                        : "text-[#34495E]"
                    }`}
                    onClick={() => selectMod(row)}
                  >
                    <span className="block">{row.commercialName}</span>
                    <span className="block text-xs text-[#7F8C8D]">
                      {row.moduleKey}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {mod ? (
            <form
              onSubmit={(e) => void saveMod(e)}
              className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
            >
              <p className="text-sm font-semibold">{mod.moduleKey}</p>
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("visibility")}
                <select
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={modVis}
                  onChange={(e) => setModVis(e.target.value)}
                >
                  <option value="VISIBLE">VISIBLE</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("maturity")}
                <select
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={modMat}
                  onChange={(e) => setModMat(e.target.value)}
                >
                  <option value="">{t("inherit")}</option>
                  <option value="prod">prod</option>
                  <option value="pilot">pilot</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("sortOrder")}
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={modSort}
                  onChange={(e) => setModSort(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[#34495E]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={modSubsection}
                  onChange={(e) => setModSubsection(e.target.checked)}
                />
                {t("showAsSubsection")}
              </label>
              <p className="text-xs font-semibold text-[#7F8C8D]">{t("modDescriptions")}</p>
              {(
                [
                  ["az", modNameAz, setModNameAz, modDescAz, setModDescAz],
                  ["ru", modNameRu, setModNameRu, modDescRu, setModDescRu],
                  ["en", modNameEn, setModNameEn, modDescEn, setModDescEn],
                ] as const
              ).map(([loc, n, sn, d, sd]) => (
                <div key={loc} className="space-y-2">
                  <input
                    className={MODAL_INPUT_CLASS}
                    value={n}
                    onChange={(e) => sn(e.target.value)}
                    placeholder={`${loc} ${t("name")}`}
                  />
                  <textarea
                    className={`${MODAL_INPUT_CLASS} min-h-[2.5rem]`}
                    value={d}
                    onChange={(e) => sd(e.target.value)}
                    placeholder={`${loc} ${t("description")}`}
                  />
                </div>
              ))}
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {t("save")}
              </button>
            </form>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("selectModule")}</p>
          )}
        </div>
      ) : null}

      {tab === "industries" ? (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <div className="space-y-3">
            <div className={CARD_CONTAINER_CLASS}>
              <ul className="max-h-[55vh] divide-y divide-[#EBEDF0] overflow-auto">
                {industries.map((row) => (
                  <li key={row.slug}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm ${
                        selectedInd === row.slug
                          ? "bg-[#EBF5FB] font-medium text-[#2980B9]"
                          : "text-[#34495E]"
                      }`}
                      onClick={() => selectInd(row)}
                    >
                      {asMap(row.names).en ||
                        asMap(row.names).ru ||
                        asMap(row.names).az ||
                        row.slug}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-3`}>
              <p className="text-xs text-[#7F8C8D]">{t("newIndustryHint")}</p>
              <input
                className={MODAL_INPUT_CLASS}
                value={newIndSlug}
                onChange={(e) => setNewIndSlug(e.target.value)}
                placeholder="slug"
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || !newIndSlug.trim()}
                onClick={() => void createInd()}
              >
                {t("createIndustry")}
              </button>
            </div>
          </div>
          {ind ? (
            <form
              onSubmit={(e) => void saveInd(e)}
              className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
            >
              <p className="font-semibold text-[#34495E]">{ind.slug}</p>
              <p className="text-xs text-[#7F8C8D]">{t("bundlePickHint")}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["az", "ru", "en"] as const).map((loc) => (
                  <input
                    key={loc}
                    className={MODAL_INPUT_CLASS}
                    value={indNames[loc] ?? ""}
                    onChange={(e) =>
                      setIndNames((prev) => ({ ...prev, [loc]: e.target.value }))
                    }
                    placeholder={`${loc} ${t("name")}`}
                  />
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["az", "ru", "en"] as const).map((loc) => (
                  <textarea
                    key={`d-${loc}`}
                    className={`${MODAL_INPUT_CLASS} min-h-[2.5rem]`}
                    value={indDescs[loc] ?? ""}
                    onChange={(e) =>
                      setIndDescs((prev) => ({ ...prev, [loc]: e.target.value }))
                    }
                    placeholder={`${loc} ${t("description")}`}
                  />
                ))}
              </div>
              <label className="block text-xs font-medium text-[#7F8C8D]">
                {t("visibility")}
                <select
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={indVis}
                  onChange={(e) => setIndVis(e.target.value)}
                >
                  <option value="VISIBLE">VISIBLE</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </label>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#34495E]">{t("bundleItems")}</p>
                {indItems.map((it, idx) => (
                  <div
                    key={`${it.satelliteKey}-${it.moduleKey}-${idx}`}
                    className="grid gap-2 rounded-lg border border-[#EBEDF0] p-2 sm:grid-cols-4"
                  >
                    <select
                      className={MODAL_INPUT_CLASS}
                      value={it.satelliteKey}
                      onChange={(e) => {
                        const next = [...indItems];
                        next[idx] = { ...it, satelliteKey: e.target.value };
                        setIndItems(next);
                      }}
                    >
                      {keys.satellites.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name} ({s.key})
                        </option>
                      ))}
                    </select>
                    <select
                      className={MODAL_INPUT_CLASS}
                      value={it.moduleKey}
                      onChange={(e) => {
                        const next = [...indItems];
                        next[idx] = { ...it, moduleKey: e.target.value };
                        setIndItems(next);
                      }}
                    >
                      <option value="">{t("wholeProduct")}</option>
                      {keys.modules
                        .filter(
                          (m) =>
                            !m.satelliteKey || m.satelliteKey === it.satelliteKey,
                        )
                        .map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.key}
                          </option>
                        ))}
                    </select>
                    <select
                      className={MODAL_INPUT_CLASS}
                      value={it.role}
                      onChange={(e) => {
                        const next = [...indItems];
                        next[idx] = {
                          ...it,
                          role: e.target.value as "C" | "I" | "O",
                        };
                        setIndItems(next);
                      }}
                    >
                      <option value="C">C</option>
                      <option value="I">I</option>
                      <option value="O">O</option>
                    </select>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() =>
                        setIndItems(indItems.filter((_, i) => i !== idx))
                      }
                    >
                      {t("remove")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    setIndItems([
                      ...indItems,
                      {
                        satelliteKey: keys.satellites[0]?.key ?? "",
                        moduleKey: "",
                        role: "I",
                        assumed: false,
                        sortOrder: indItems.length + 1,
                      },
                    ])
                  }
                  disabled={!keys.satellites.length}
                >
                  {t("addItem")}
                </button>
              </div>
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {t("save")}
              </button>
            </form>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("selectIndustry")}</p>
          )}
        </div>
      ) : null}

      {tab === "edges" ? (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <div className={CARD_CONTAINER_CLASS}>
            <p className="border-b border-[#EBEDF0] px-3 py-2 text-xs text-[#7F8C8D]">
              {t("edgesHint")}
            </p>
            <ul className="max-h-[70vh] divide-y divide-[#EBEDF0] overflow-auto">
              {edges.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${
                      selectedEdge === row.id
                        ? "bg-[#EBF5FB] font-medium text-[#2980B9]"
                        : "text-[#34495E]"
                    }`}
                    onClick={() => selectEdge(row)}
                  >
                    <span className="block truncate">
                      {row.fromKey} → {row.toKey}
                    </span>
                    <span className="block text-xs text-[#7F8C8D]">
                      {row.kind} · {row.realizationStatus}
                      {row.autoManaged ? ` · ${t("edgeAuto")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {edges.length === 0 ? (
              <p className="p-3 text-sm text-[#7F8C8D]">{t("emptyEdges")}</p>
            ) : null}
          </div>
          {edge ? (
            <form
              onSubmit={(e) => void saveEdge(e)}
              className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}
            >
              <p className="text-sm font-medium text-[#34495E]">
                {edge.fromKey} → {edge.toKey}
              </p>
              <p className="text-xs text-[#7F8C8D]">
                {edge.kind} · id {edge.id}
              </p>
              <label className="block text-xs text-[#7F8C8D]">
                {t("edgeStatus")}
                <select
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={edgeStatus}
                  onChange={(e) =>
                    setEdgeStatus(
                      e.target.value as "live" | "partial" | "planned",
                    )
                  }
                >
                  <option value="live">live</option>
                  <option value="partial">partial</option>
                  <option value="planned">planned</option>
                </select>
              </label>
              <label className="block text-xs text-[#7F8C8D]">
                {t("visibility")}
                <select
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={edgeVis}
                  onChange={(e) => setEdgeVis(e.target.value)}
                >
                  <option value="VISIBLE">VISIBLE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </label>
              <label className="block text-xs text-[#7F8C8D]">
                {t("sortOrder")}
                <input
                  className={`${MODAL_INPUT_CLASS} mt-1`}
                  value={edgeSort}
                  onChange={(e) => setEdgeSort(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[#34495E]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={edgeAuto}
                  onChange={(e) => setEdgeAuto(e.target.checked)}
                />
                {t("edgeAuto")}
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block text-xs text-[#7F8C8D]">
                  {t("edgeLabel")} az
                  <input
                    className={`${MODAL_INPUT_CLASS} mt-1`}
                    value={edgeLabelAz}
                    onChange={(e) => setEdgeLabelAz(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-[#7F8C8D]">
                  {t("edgeLabel")} ru
                  <input
                    className={`${MODAL_INPUT_CLASS} mt-1`}
                    value={edgeLabelRu}
                    onChange={(e) => setEdgeLabelRu(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-[#7F8C8D]">
                  {t("edgeLabel")} en
                  <input
                    className={`${MODAL_INPUT_CLASS} mt-1`}
                    value={edgeLabelEn}
                    onChange={(e) => setEdgeLabelEn(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="submit"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
              >
                {t("save")}
              </button>
            </form>
          ) : (
            <p className="text-sm text-[#7F8C8D]">{t("selectEdge")}</p>
          )}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <p className="text-sm text-[#7F8C8D]">{t("settingsHint")}</p>
          {settings.map((row) => (
            <SiteSettingRow
              key={row.key}
              row={row}
              busy={busy}
              onSave={(value) => void saveSetting(row.key, value)}
              saveLabel={t("save")}
            />
          ))}
          {settings.length === 0 ? (
            <p className="text-sm text-[#7F8C8D]">{t("emptySettings")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SiteSettingRow({
  row,
  busy,
  onSave,
  saveLabel,
}: {
  row: SiteConfigRow;
  busy: boolean;
  onSave: (value: unknown) => void;
  saveLabel: string;
}) {
  const [value, setValue] = useState(
    row.valueKind === "boolean"
      ? String(Boolean(row.effectiveValue))
      : String(row.effectiveValue ?? row.storedValue ?? ""),
  );
  return (
    <div className="grid gap-2 border-b border-[#EBEDF0] pb-3 sm:grid-cols-[1fr_12rem_auto]">
      <div>
        <p className="text-sm font-medium text-[#34495E]">{row.key}</p>
        <p className="text-xs text-[#7F8C8D]">{row.description}</p>
      </div>
      {row.valueKind === "boolean" ? (
        <select
          className={MODAL_INPUT_CLASS}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!row.allowPut}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          className={MODAL_INPUT_CLASS}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!row.allowPut || row.valueKind === "secret"}
          placeholder={row.valueKind === "secret" ? "••••••••" : undefined}
        />
      )}
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        disabled={busy || !row.allowPut}
        onClick={() =>
          onSave(
            row.valueKind === "boolean"
              ? value === "true"
              : row.valueKind === "positive_int"
                ? Number(value) || 0
                : value,
          )
        }
      >
        {saveLabel}
      </button>
    </div>
  );
}
