"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  FieldGroupBox,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import {
  authorLabelFrom,
  type PractitionerAuthorRef,
} from "@/domain/staff/practitioner-label";

type Props = {
  episodeId: string;
  readOnly?: boolean;
  initialText?: string | null;
  initialAuthor?: PractitionerAuthorRef;
  onSaved?: (payload: {
    anamnesisText: string | null;
    anamnesisByPractitioner: PractitionerAuthorRef;
    day1Program?: unknown;
  }) => void;
};

export function PatientCardAnamnesis({
  episodeId,
  readOnly = false,
  initialText = null,
  initialAuthor = null,
  onSaved,
}: Props) {
  const t = useTranslations("patientCard");
  const tr = useTranslations("patientRegistry");
  const tc = useTranslations("common");
  const [text, setText] = useState(initialText?.trim() ?? "");
  const [author, setAuthor] = useState<PractitionerAuthorRef>(initialAuthor);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const hasAnamnesis = Boolean(text.trim());

  useEffect(() => {
    setText(initialText?.trim() ?? "");
    setAuthor(initialAuthor ?? null);
  }, [episodeId, initialText, initialAuthor]);

  function openCreate() {
    setDraft("");
    setOpen(true);
  }

  function openEdit() {
    setDraft(text);
    setOpen(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anamnesisText: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc("failed"));
      return;
    }
    const payload = (data.data ?? data) as {
      anamnesisText?: string | null;
      anamnesisByPractitioner?: PractitionerAuthorRef;
      day1Program?: unknown;
    };
    const nextText = payload.anamnesisText?.trim() ?? trimmed;
    const nextAuthor = payload.anamnesisByPractitioner ?? author;
    setText(nextText);
    setAuthor(nextAuthor);
    setOpen(false);
    onSaved?.({
      anamnesisText: nextText,
      anamnesisByPractitioner: nextAuthor,
      day1Program: payload.day1Program,
    });
  }

  const authorLine = authorLabelFrom(author);

  return (
    <FieldGroupBox
      title={tr("anamnesis")}
      actions={
        <div className="flex items-center gap-1">
          {authorLine ? (
            <span className={`mr-1 text-[12px] ${TEXT_MUTED_CLASS}`}>{authorLine}</span>
          ) : null}
          {!readOnly ? (
            hasAnamnesis ? (
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("edit")}
                onClick={openEdit}
              >
                <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
              </button>
            ) : (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("addAnamnesis")}
              </button>
            )
          ) : null}
        </div>
      }
    >
      {hasAnamnesis ? (
        <p className="whitespace-pre-wrap text-sm text-[#2C3E50]">{text}</p>
      ) : (
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>—</p>
      )}
      <ModalShell
        open={open}
        title={hasAnamnesis ? tc("edit") : t("addAnamnesis")}
        onClose={() => setOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={() => void save()}
            busy={busy}
            submitDisabled={!draft.trim()}
            submitLabel={tc("save")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <FieldTextarea
          label={tr("anamnesis")}
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={tr("anamnesisHint")}
        />
      </ModalShell>
    </FieldGroupBox>
  );
}
