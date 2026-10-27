"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_OUTLINE_CLASS,
  MODAL_FOOTER_PRIMARY_CLASS,
} from "./design-system";

/**
 * Several layers can lock scroll at once (fullscreen, then a modal on top).
 * Each one must not restore the previous value while another lock is still open.
 */
let bodyScrollLocks = 0;
let bodyScrollRestore = "";

function lockBodyScroll(): () => void {
  if (bodyScrollLocks === 0) {
    bodyScrollRestore = document.body.style.overflow;
  }
  bodyScrollLocks += 1;
  document.body.style.overflow = "hidden";
  return () => {
    bodyScrollLocks = Math.max(0, bodyScrollLocks - 1);
    if (bodyScrollLocks === 0) {
      document.body.style.overflow = bodyScrollRestore;
    }
  };
}

/** Page content sits in a z-0 stacking context under the fixed header and sidebar. */
function useDocumentBody(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  return host;
}

export function ModalShell({
  open = true,
  title,
  subtitle,
  onClose,
  children,
  footer,
  headerActions,
  maxWidthClass = "max-w-lg",
  bodyClassName = "mt-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
  footerClassName = "shrink-0",
  closeLabel = "Close",
  /** Overlay stacking. Nested modals (confirm over editor) use a higher value. */
  overlayZClass = "z-[200]",
}: {
  /** When omitted, the shell is open (typical `{show ? <ModalShell>` mounts). */
  open?: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Secondary actions next to the close control (menu, print, attach). */
  headerActions?: ReactNode;
  maxWidthClass?: string;
  bodyClassName?: string;
  footerClassName?: string;
  closeLabel?: string;
  overlayZClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  const host = useDocumentBody();
  if (!open || !host) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-start justify-center overflow-hidden bg-black/40 p-4 pb-6 pt-10`}
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className={`${MODAL_DIALOG_CONTENT_CLASS} ${maxWidthClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="era-modal-title"
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
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              className={MODAL_CLOSE_BUTTON_CLASS}
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className={bodyClassName}>{children}</div>

        {footer != null ? <footer className={footerClassName}>{footer}</footer> : null}
      </div>
    </div>,
    host,
  );
}

/**
 * Full-screen ops layer (resource matrix, room plan, timesheet).
 * Portaled like ModalShell, one step under it (z-180 vs z-200).
 */
export function ViewportOverlay({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label: string;
}) {
  const host = useDocumentBody();
  useEffect(() => lockBodyScroll(), []);
  if (!host) return null;
  return createPortal(
    <div className={className} role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>,
    host,
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
