'use client';

import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

export function CancelOtaModal({
  open,
  busy,
  cancelRef,
  onCancelRef,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  cancelRef: string;
  onCancelRef: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useTranslations('channel');
  const formId = 'cancel-ota-form';

  return (
    <EraModal
      open={open}
      title={t('cancelOta')}
      subtitle={t('cancelOtaHint')}
      onClose={onClose}
      footer={
        <EraModalFooter
          formId={formId}
          onCancel={onClose}
          busy={busy}
          submitLabel={busy ? t('cancelling') : t('cancelOta')}
        />
      }
    >
      <form id={formId} onSubmit={onSubmit} className={FORM_STACK_CLASS}>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="cancel-ota-ref">
            {t('cancelOtaRef')}
          </label>
          <input
            id="cancel-ota-ref"
            className={MODAL_INPUT_CLASS}
            value={cancelRef}
            onChange={(e) => onCancelRef(e.target.value)}
            placeholder={t('cancelOtaPlaceholder')}
            required
          />
        </div>
      </form>
    </EraModal>
  );
}
