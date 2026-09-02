"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

export type CareDoctorItem = {
  id: string;
  practitionerId: string;
  practitioner: {
    id: string;
    code: string;
    fullName: string;
    specialty: string | null;
  };
};

type Candidate = {
  id: string;
  code: string;
  fullName: string;
  specialty: string | null;
};

type Props = {
  episodeId: string;
  readOnly: boolean;
  onTeamChange?: (items: CareDoctorItem[]) => void;
};

export function PatientCardCareTeam({ episodeId, readOnly, onTeamChange }: Props) {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [items, setItems] = useState<CareDoctorItem[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/care-team`);
    if (!res.ok) {
      setItems([]);
      setCandidates([]);
      onTeamChange?.([]);
      return;
    }
    const parsed = await res.json();
    const payload = (parsed.data ?? parsed) as {
      items?: CareDoctorItem[];
      candidates?: Candidate[];
    };
    const rows = payload.items ?? [];
    setItems(rows);
    setCandidates(payload.candidates ?? []);
    onTeamChange?.(rows);
  }, [episodeId, onTeamChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const doctorOptions = useMemo(
    () =>
      candidates.map((d) => ({
        value: d.id,
        label: `${d.fullName}${d.specialty ? ` · ${d.specialty}` : ""} (${d.code})`,
      })),
    [candidates],
  );

  async function addDoctor() {
    if (!pickId || readOnly) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/care-team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practitionerId: pickId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr((data as { error?: string }).error ?? tc("failed"));
      return;
    }
    setPickId("");
    await load();
  }

  async function removeDoctor(practitionerId: string) {
    if (readOnly) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(
      `/api/sanatorium/episodes/${episodeId}/care-team?practitionerId=${encodeURIComponent(practitionerId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        code?: string;
      };
      setErr(
        data.code === "LAST_CARE_DOCTOR"
          ? t("careTeamLastDoctor")
          : (data.error ?? tc("failed")),
      );
      return;
    }
    await load();
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        {t("careTeamTitle")}
      </h2>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("careTeamHint")}</p>
        {items.length === 0 ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("careTeamEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
              >
                <span>
                  {row.practitioner.fullName}
                  {row.practitioner.specialty ? (
                    <span className={`ml-2 text-xs ${TEXT_MUTED_CLASS}`}>
                      {row.practitioner.specialty}
                    </span>
                  ) : null}
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={t("careTeamRemove")}
                    disabled={busy}
                    onClick={() => void removeDoctor(row.practitionerId)}
                  >
                    <Trash2 className="h-4 w-4 text-[#C0392B]" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!readOnly ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <CatalogField
                kind="SEARCHABLE"
                label={t("careTeamPick")}
                value={pickId}
                onChange={(v) => setPickId(String(v ?? ""))}
                options={doctorOptions}
                emptyLabel={t("careTeamPickEmpty")}
              />
            </div>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !pickId}
              onClick={() => void addDoctor()}
            >
              <Plus className="mr-1 inline h-4 w-4" aria-hidden />
              {t("careTeamAdd")}
            </button>
          </div>
        ) : null}
        {err ? <p className={`text-sm ${TEXT_DANGER_CLASS}`}>{err}</p> : null}
        {items.length === 0 && !readOnly ? (
          <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("careTeamGateHint")}</p>
        ) : null}
        {readOnly ? (
          <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("episodeClosedReadOnly")}</p>
        ) : null}
      </div>
    </section>
  );
}
