'use client';

import { ModalFooter, ModalShell } from '@era/satellite-kit/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function EraModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClass,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}) {
  const tc = useTranslations('common');
  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={footer}
      maxWidthClass={maxWidthClass}
      closeLabel={tc('close')}
    >
      {children}
    </ModalShell>
  );
}

export function EraModalFooter({
  onCancel,
  onSubmit,
  busy,
  submitDisabled,
  formId,
  submitLabel,
  cancelLabel,
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  busy?: boolean;
  submitDisabled?: boolean;
  formId?: string;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const tc = useTranslations('common');
  return (
    <ModalFooter
      onCancel={onCancel}
      onSubmit={onSubmit}
      busy={busy}
      submitDisabled={submitDisabled}
      formId={formId}
      cancelLabel={cancelLabel ?? tc('cancel')}
      submitLabel={submitLabel ?? tc('save')}
    />
  );
}
