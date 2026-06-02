'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';

export function GroupCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('groupReservations');
  const tc = useTranslations('common');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/reservation-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setCode('');
      setName('');
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal open={open} title={t('createTitle')} onClose={onClose} maxWidthClass="max-w-md w-full">
      <div className="space-y-3">
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('code')}</label>
          <input className={MODAL_INPUT_CLASS} value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{t('name')}</label>
          <input className={MODAL_INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void submit()}>
          {tc('save')}
        </button>
      </div>
    </EraModal>
  );
}
