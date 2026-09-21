"use client";

import {
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export function WorkforceConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell open={open} title={title} onClose={onCancel} closeLabel={cancelLabel}>
      <p className="text-sm text-[#34495E]">{body}</p>
      <ModalFooter>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={
            danger
              ? `${PRIMARY_BUTTON_CLASS} bg-[#C0392B] hover:bg-[#A93226]`
              : PRIMARY_BUTTON_CLASS
          }
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}
