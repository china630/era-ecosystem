"use client";

import {
  ModalFooter,
  ModalShell,
} from "@era/satellite-kit/ui";

export function WorkforceConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
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
    <ModalShell
      open={open}
      title={title}
      onClose={onCancel}
      closeLabel={cancelLabel}
      footer={
        <ModalFooter
          onCancel={onCancel}
          onSubmit={onConfirm}
          busy={busy}
          cancelLabel={cancelLabel}
          submitLabel={confirmLabel}
        />
      }
    >
      <p className="text-sm text-[#34495E]">{body}</p>
    </ModalShell>
  );
}
