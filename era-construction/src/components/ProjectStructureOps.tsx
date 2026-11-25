"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FieldRow, FORM_STACK_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";

type Phase = { id: string; code: string; name: string; sortOrder: number };
type Location = { id: string; code: string; name: string };

export function ProjectStructureOps({ projectId }: { projectId: string }) {
  const t = useTranslations("projectsDetail.structure");
  const tc = useTranslations("common");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [phaseCode, setPhaseCode] = useState("");
  const [phaseName, setPhaseName] = useState("");
  const [locCode, setLocCode] = useState("");
  const [locName, setLocName] = useState("");

  const load = useCallback(async () => {
    const [pRes, lRes] = await Promise.all([
      apiJson<Phase[]>(`/api/projects/${projectId}/phases`),
      apiJson<Location[]>(`/api/projects/${projectId}/locations`),
    ]);
    if (!pRes.ok) {
      setMessage(pRes.error);
      return;
    }
    if (!lRes.ok) {
      setMessage(lRes.error);
      return;
    }
    setPhases(Array.isArray(pRes.data) ? pRes.data : []);
    setLocations(Array.isArray(lRes.data) ? lRes.data : []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePhase(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/projects/${projectId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: phaseCode.trim(), name: phaseName.trim() || phaseCode.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setPhaseCode("");
    setPhaseName("");
    setMessage(t("phaseSaved"));
    await load();
  }

  async function saveLocation(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/projects/${projectId}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: locCode.trim(), name: locName.trim() || locCode.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setLocCode("");
    setLocName("");
    setMessage(t("locationSaved"));
    await load();
  }

  async function removePhase(phaseId: string) {
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/phases?phaseId=${encodeURIComponent(phaseId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    await load();
  }

  async function removeLocation(locationId: string) {
    setBusy(true);
    const res = await apiJson(
      `/api/projects/${projectId}/locations?locationId=${encodeURIComponent(locationId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold">{t("title")}</h2>
        <p className="text-[12px] text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {message ? <p className="text-[13px]">{message}</p> : null}

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("phasesTitle")}</h3>
        {phases.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("phasesEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {phases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b py-1">
                <span>
                  {p.code} — {p.name}
                </span>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void removePhase(p.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={savePhase} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("code")}
              preset="code"
              value={phaseCode}
              onChange={(e) => setPhaseCode(e.target.value)}
              required
            />
            <Field
              label={tc("name")}
              preset="shortText"
              value={phaseName}
              onChange={(e) => setPhaseName(e.target.value)}
            />
          </FieldRow>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !phaseCode.trim()}>
            {t("savePhase")}
          </button>
        </form>
      </section>

      <section className="rounded border p-3 space-y-3">
        <h3 className="text-[13px] font-medium">{t("locationsTitle")}</h3>
        {locations.length === 0 ? (
          <p className="text-[12px] text-[#7F8C8D]">{t("locationsEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 border-b py-1">
                <span>
                  {l.code} — {l.name}
                </span>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void removeLocation(l.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveLocation} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("code")}
              preset="code"
              value={locCode}
              onChange={(e) => setLocCode(e.target.value)}
              required
            />
            <Field
              label={tc("name")}
              preset="shortText"
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
            />
          </FieldRow>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy || !locCode.trim()}>
            {t("saveLocation")}
          </button>
        </form>
      </section>
    </div>
  );
}
