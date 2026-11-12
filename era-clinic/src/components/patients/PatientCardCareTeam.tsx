"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  FieldGroupBox,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";

import { formatPractitionerLabel } from "@/domain/staff/practitioner-label";

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

/** Display: "Terapevt - Kəngərli Rəna …" (specialty first; no staff codes). */
export function formatCareDoctorLabel(
  specialty: string | null | undefined,
  fullName: string,
): string {
  return formatPractitionerLabel(specialty, fullName);
}

export function PatientCardCareTeam({ episodeId, readOnly, onTeamChange }: Props) {
  const t = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [items, setItems] = useState<CareDoctorItem[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
        label: formatCareDoctorLabel(d.specialty, d.fullName),
      })),
    [candidates],
  );

  async function addDoctor() {
    if (!pickId || readOnly) return;
    setBusy(true);
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/care-team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practitionerId: pickId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showApiError(data, tc("failed"));
      return;
    }
    setPickId("");
    setAddOpen(false);
    await load();
  }

  async function removeDoctor(practitionerId: string) {
    if (readOnly) return;
    setBusy(true);
    const res = await fetch(
      `/api/sanatorium/episodes/${episodeId}/care-team?practitionerId=${encodeURIComponent(practitionerId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (data.code === "LAST_CARE_DOCTOR") {
        showApiError({ error: t("careTeamLastDoctor") });
      } else {
        showApiError(data, tc("failed"));
      }
      return;
    }
    await load();
  }

  return (
    <div>
      {!readOnly ? (
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 inline h-4 w-4" aria-hidden />
            {t("careTeamAdd")}
          </button>
        </div>
      ) : null}
    <FieldGroupBox title={t("careTeamTitle")}>
      {items.length > 0 ? (
        <ul className="list-none text-sm">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0"
            >
              <span className="min-w-0 truncate font-medium text-[#2C3E50]">
                {formatCareDoctorLabel(row.practitioner.specialty, row.practitioner.fullName)}
              </span>
              {!readOnly ? (
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={t("careTeamRemove")}
                  disabled={busy}
                  onClick={() => setRemoveId(row.practitionerId)}
                >
                  <Trash2 className="h-4 w-4 text-[#C0392B]" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>—</p>
      )}
      <ModalShell
        open={addOpen}
        title={t("careTeamAdd")}
        onClose={() => setAddOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            onCancel={() => setAddOpen(false)}
            onSubmit={() => void addDoctor()}
            busy={busy}
            submitDisabled={!pickId}
            submitLabel={tc("save")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <CatalogField
          kind="SEARCHABLE"
          label={t("careTeamPick")}
          value={pickId}
          onChange={(v) => setPickId(String(v ?? ""))}
          options={doctorOptions}
          emptyLabel={t("careTeamPickEmpty")}
          widthPreset="select"
        />
      </ModalShell>
      <ModalShell
        open={Boolean(removeId)}
        title={t("careTeamRemoveConfirm")}
        onClose={() => {
          if (!busy) setRemoveId(null);
        }}
      >
        <ModalFooter
          onCancel={() => setRemoveId(null)}
          onSubmit={() => {
            if (!removeId) return;
            const id = removeId;
            setRemoveId(null);
            void removeDoctor(id);
          }}
          submitLabel={t("careTeamRemove")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>
    </FieldGroupBox>
    </div>
  );
}
