'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  Field,
  ModalFooter,
  ModalShell,
  showApiError,
} from '@era/satellite-kit/ui';

export type CollectionKind = 'document' | 'contact' | 'address';

const DOC_TYPES = ['PASSPORT', 'ID_CARD', 'FIN', 'VISA', 'OTHER'] as const;
const CONTACT_KINDS = ['MOBILE', 'PHONE', 'EMAIL', 'WHATSAPP'] as const;
const ADDRESS_KINDS = ['HOME', 'WORK', 'OTHER'] as const;

export function GuestCardCollectionModal({
  open,
  kind,
  guestId,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: CollectionKind;
  guestId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState('PASSPORT');
  const [docNumber, setDocNumber] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issuePlace, setIssuePlace] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [contactKind, setContactKind] = useState('MOBILE');
  const [contactValue, setContactValue] = useState('');
  const [addressKind, setAddressKind] = useState('HOME');
  const [line1, setLine1] = useState('');

  const docOptions = DOC_TYPES.map((code) => ({ value: code, label: t(`docType.${code}`) }));
  const contactOptions = CONTACT_KINDS.map((code) => ({ value: code, label: t(`contactKind.${code}`) }));
  const addressOptions = ADDRESS_KINDS.map((code) => ({ value: code, label: t(`addressKind.${code}`) }));

  async function submit() {
    setBusy(true);
    try {
      let url = '';
      let body: Record<string, unknown> = {};
      if (kind === 'document') {
        if (!docNumber.trim()) {
          showApiError({ error: tc('requiredNamed', { field: t('grid.number') }) });
          return;
        }
        url = `/api/guests/${guestId}/documents`;
        body = {
          docType,
          docNumber: docNumber.trim(),
          serialNo: serialNo.trim() || null,
          issuingAuthority: issuer.trim() || null,
          issuePlace: issuePlace.trim() || null,
          expiresAt: expiresAt || undefined,
          isPrimary,
        };
      } else if (kind === 'contact') {
        if (!contactValue.trim()) {
          showApiError({ error: tc('requiredNamed', { field: t('grid.contact') }) });
          return;
        }
        url = `/api/guests/${guestId}/contacts`;
        body = { kind: contactKind, value: contactValue.trim(), isPrimary };
      } else {
        if (!line1.trim()) {
          showApiError({ error: tc('requiredNamed', { field: t('grid.address') }) });
          return;
        }
        url = `/api/guests/${guestId}/addresses`;
        body = { kind: addressKind, line1: line1.trim() };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const title =
    kind === 'document' ? t('addDocument') : kind === 'contact' ? t('addContact') : t('addAddress');

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onClose}
      closeLabel={tc('close')}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          cancelLabel={tc('cancel')}
          submitLabel={tc('save')}
        />
      }
    >
      {kind === 'document' ? (
        <div className="space-y-3">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('grid.type')}
            value={docType}
            onChange={(v) => setDocType(Array.isArray(v) ? v[0] ?? 'PASSPORT' : v)}
            options={docOptions}
          />
          <Field label={t('grid.number')} preset="shortText" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} required />
          <Field label={t('grid.serial')} preset="shortText" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          <Field label={t('grid.issuer')} preset="longText" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          <Field label={t('grid.issuePlace')} preset="shortText" value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} />
          <DatePicker
            label={t('grid.expires')}
            fluid
            value={expiresAt}
            onChange={setExpiresAt}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            {t('grid.primary')}
          </label>
        </div>
      ) : null}
      {kind === 'contact' ? (
        <div className="space-y-3">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('grid.type')}
            value={contactKind}
            onChange={(v) => setContactKind(Array.isArray(v) ? v[0] ?? 'MOBILE' : v)}
            options={contactOptions}
          />
          <Field
            label={t('grid.contact')}
            preset={contactKind === 'EMAIL' ? 'longText' : 'phone'}
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            {t('grid.primary')}
          </label>
        </div>
      ) : null}
      {kind === 'address' ? (
        <div className="space-y-3">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('grid.type')}
            value={addressKind}
            onChange={(v) => setAddressKind(Array.isArray(v) ? v[0] ?? 'HOME' : v)}
            options={addressOptions}
          />
          <Field label={t('grid.address')} preset="longText" value={line1} onChange={(e) => setLine1(e.target.value)} required />
        </div>
      ) : null}
    </ModalShell>
  );
}
