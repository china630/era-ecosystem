"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_OUTLINE_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
} from "./design-system";

export function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-lg",
  closeLabel = "Close",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  closeLabel?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`${MODAL_DIALOG_CONTENT_CLASS} ${maxWidthClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="era-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id="era-modal-title"
              className="m-0 text-lg font-semibold leading-snug text-[#34495E]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mb-0 mt-1 text-[13px] leading-snug text-[#7F8C8D]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className={MODAL_CLOSE_BUTTON_CLASS}
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer != null ? <footer className="shrink-0">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ModalFooter({
  onCancel,
  onSubmit,
  busy,
  submitDisabled,
  formId,
  cancelLabel = "Cancel",
  submitLabel = "Save",
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  busy?: boolean;
  submitDisabled?: boolean;
  formId?: string;
  cancelLabel?: string;
  submitLabel?: string;
}) {
  return (
    <div className={MODAL_FOOTER_ACTIONS_CLASS}>
      <button
        type="button"
        className={MODAL_FOOTER_OUTLINE_CLASS}
        onClick={onCancel}
        disabled={!!busy}
      >
        {cancelLabel}
      </button>
      {formId ? (
        <button
          type="submit"
          form={formId}
          className={MODAL_FOOTER_PRIMARY_CLASS}
          disabled={!!busy || !!submitDisabled}
        >
          {busy ? "…" : submitLabel}
        </button>
      ) : (
        <button
          type="button"
          className={MODAL_FOOTER_PRIMARY_CLASS}
          disabled={!!busy || !!submitDisabled}
          onClick={() => void onSubmit?.()}
        >
          {busy ? "…" : submitLabel}
        </button>
      )}
    </div>
  );
}
