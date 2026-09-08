'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraModal } from '@/components/EraModal';
import { MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export type IdReaderPayload = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  nationality?: string;
  passportNumber?: string;
  nationalIdFin?: string;
  birthDate?: string;
  gender?: string;
  sex?: string;
};

export function GuestCardIdReaderModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (data: IdReaderPayload) => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [raw, setRaw] = useState('');

  function apply() {
    try {
      const data = JSON.parse(raw) as IdReaderPayload;
      onApply(data);
      setRaw('');
      onClose();
    } catch {
      window.alert(t('idReaderInvalid'));
    }
  }

  return (
    <EraModal open={open} title={t('idReader')} onClose={onClose} maxWidthClass="max-w-lg">
      <p className="mb-2 text-[13px] text-[#7F8C8D]">{t('idReaderHint')}</p>
      <textarea
        className={`${MODAL_INPUT_CLASS} min-h-[120px] font-mono text-[12px]`}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='{"firstName":"Ali","lastName":"Mammadov","passportNumber":"AA1234567"}'
      />
      <div className="mt-3 flex gap-2">
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={apply}>
          {t('idReaderApply')}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
          {tc('close')}
        </button>
      </div>
    </EraModal>
  );
}
