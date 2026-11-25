"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  FORM_STACK_CLASS,
  FieldSelect,
  ModalFooter,
  ModalShell,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type PickerItem = {
  id: string;
  globalPersonId: string;
  name: string;
  orgUnitName: string | null;
  positionName: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpened: (episodeId: string, patientId: string | null) => void;
};

const DAY_OPTIONS = [7, 10, 14, 21];

export function StaffBenefitCourseModal({ open, onClose, onOpened }: Props) {
  const t = useTranslations("sanatorium");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [employmentId, setEmploymentId] = useState("");
  const [courseDays, setCourseDays] = useState(10);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPicker = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/sanatorium/workforce-picker");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setItems([]);
      setLoadError(
        typeof data?.error === "string" ? data.error : t("workforcePickerUnavailable"),
      );
      return;
    }
    const list = Array.isArray(data.items) ? (data.items as PickerItem[]) : [];
    setItems(list);
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setEmploymentId("");
    setCourseDays(10);
    void loadPicker();
  }, [open, loadPicker]);

  const options = useMemo(
    () =>
      items.map((row) => ({
        value: row.id,
        label: [row.name, row.positionName, row.orgUnitName].filter(Boolean).join(" · "),
      })),
    [items],
  );

  async function submit() {
    if (!employmentId) {
      showApiError({ error: t("staffEmploymentRequired") });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/sanatorium/episodes/staff-course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpEmploymentId: employmentId,
        courseDays,
        programCode: "PKG-STANDART",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showApiError(data, t("failed"));
      return;
    }
    showSuccess(t("staffCourseOpened"));
    onClose();
    const episode = data.episode ?? data?.data?.episode ?? data;
    const episodeId = episode?.id as string | undefined;
    const patientId = (episode?.patientRef?.id ?? null) as string | null;
    if (episodeId) onOpened(episodeId, patientId);
  }

  return (
    <ModalShell
      open={open}
      title={t("staffCourseTitle")}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitLabel={t("staffCourseSubmit")}
        />
      }
    >
      <div className={FORM_STACK_CLASS}>
        {loadError ? (
          <p className={`text-[13px] text-[#C0392B]`}>{loadError}</p>
        ) : (
          <CatalogField
            kind="SEARCHABLE"
            label={t("staffEmployee")}
            value={employmentId}
            onChange={(v) => setEmploymentId(String(v ?? ""))}
            options={options}
            emptyLabel={t("staffEmployeeEmpty")}
            required
          />
        )}
        <FieldSelect
          label={t("courseDays")}
          preset="select"
          value={String(courseDays)}
          onChange={(e) => setCourseDays(Number(e.target.value) || 10)}
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {t("courseDaysOption", { days: d })}
            </option>
          ))}
        </FieldSelect>
        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("staffCourseHint")}</p>
      </div>
    </ModalShell>
  );
}
