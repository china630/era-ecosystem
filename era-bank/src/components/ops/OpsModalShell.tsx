"use client";

import { useTranslations } from "next-intl";
import { ModalFooter, ModalShell } from "@era/satellite-kit/ui";
import { useEodLock } from "./EodLockProvider";

type OpsModalShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  formId?: string;
  onSubmit?: () => void;
  submitLabel?: string;
  busy?: boolean;
  submitDisabled?: boolean;
  maxWidthClass?: string;
  hideFooter?: boolean;
};

export function OpsModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  formId,
  onSubmit,
  submitLabel,
  busy,
  submitDisabled,
  maxWidthClass = "max-w-lg",
  hideFooter,
}: OpsModalShellProps) {
  const t = useTranslations("common");
  const { mutationsDisabled } = useEodLock();

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      maxWidthClass={maxWidthClass}
      closeLabel={t("close")}
      footer={
        hideFooter ? undefined : (
          <ModalFooter
            onCancel={onClose}
            onSubmit={onSubmit}
            formId={formId}
            busy={busy}
            submitDisabled={submitDisabled || mutationsDisabled}
            cancelLabel={t("cancel")}
            submitLabel={submitLabel ?? t("save")}
          />
        )
      }
    >
      {children}
    </ModalShell>
  );
}
