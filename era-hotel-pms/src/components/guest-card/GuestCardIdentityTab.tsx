'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@era/satellite-kit/ui';
import {
  GuestCardCollectionModal,
  type CollectionKind,
} from '@/components/guest-card/GuestCardCollectionModal';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
} from '@era/satellite-kit/ui';

/** Compact sub-collection table for guest card — no pagination (typically 0–5 rows). */
function MiniTable({
  headers,
  empty,
  emptyLabel,
  children,
  colSpan,
}: {
  headers: string[];
  empty: boolean;
  emptyLabel: string;
  children: ReactNode;
  colSpan: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#D5DADF]">
      <table className={`${DATA_TABLE_CLASS} text-[12px]`}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            {headers.map((h) => (
              <th key={h} className={DATA_TABLE_TH_LEFT_CLASS}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr className={DATA_TABLE_TR_CLASS}>
              <td
                colSpan={colSpan}
                className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function GuestCardIdentityTab({
  guestId,
  documents,
  contacts,
  addresses,
  gdprConfirmed,
  smsConsent,
  whatsappConsent,
  phoneConsent,
  emailConsent,
  callBack,
  onConsent,
  onReload,
  draftPhone = '',
  draftEmail = '',
  onDraftChange,
}: {
  guestId: string | null;
  documents: Array<{
    id: string;
    docType: string;
    docNumber: string;
    serialNo?: string | null;
    issuingAuthority?: string | null;
    nationality?: string | null;
    issuePlace?: string | null;
    isPrimary?: boolean;
  }>;
  contacts: Array<{ id: string; kind: string; value: string }>;
  addresses: Array<{ id: string; kind: string; line1: string }>;
  gdprConfirmed: boolean;
  smsConsent: boolean;
  whatsappConsent: boolean;
  phoneConsent: boolean;
  emailConsent: boolean;
  callBack: boolean;
  onConsent: (key: string, value: boolean) => void;
  onReload: () => void;
  draftPhone?: string;
  draftEmail?: string;
  onDraftChange?: (patch: { phone?: string; email?: string }) => void;
}) {
  const t = useTranslations('guestCard');
  const dash = '—';
  const [addKind, setAddKind] = useState<CollectionKind | null>(null);

  function kindLabel(group: 'docType' | 'contactKind' | 'addressKind', code: string) {
    const known: Record<string, string[]> = {
      docType: ['PASSPORT', 'ID_CARD', 'FIN', 'VISA', 'OTHER'],
      contactKind: ['MOBILE', 'PHONE', 'EMAIL', 'WHATSAPP'],
      addressKind: ['HOME', 'WORK', 'OTHER'],
    };
    if (!known[group]?.includes(code)) return code || dash;
    return t(`${group}.${code}` as 'docType.PASSPORT');
  }

  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <h3 className="mb-2 font-semibold text-[#34495E]">{t('documents')}</h3>
        <p className="mb-2 text-[12px] text-[#7F8C8D]">{t('summary.documentAtCheckIn')}</p>
        <MiniTable
          headers={[
            t('grid.type'),
            t('grid.number'),
            t('grid.serial'),
            t('grid.issuer'),
            t('grid.nationality'),
            t('grid.issuePlace'),
            t('grid.primary'),
          ]}
          empty={documents.length === 0}
          emptyLabel={t('grid.empty')}
          colSpan={7}
        >
          {documents.map((r) => (
            <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS}>{r.docType ? kindLabel('docType', r.docType) : dash}</td>
              <td className={DATA_TABLE_TD_CLASS}>{r.docNumber || dash}</td>
              <td className={DATA_TABLE_TD_CLASS}>{r.serialNo || dash}</td>
              <td className={DATA_TABLE_TD_CLASS}>{r.issuingAuthority || dash}</td>
              <td className={DATA_TABLE_TD_CLASS}>{r.nationality || dash}</td>
              <td className={DATA_TABLE_TD_CLASS}>{r.issuePlace || dash}</td>
              <td className={DATA_TABLE_TD_CLASS}>{r.isPrimary ? '✓' : dash}</td>
            </tr>
          ))}
        </MiniTable>
        {guestId ? (
          <button
            type="button"
            className="mt-2 text-[12px] font-medium text-[#2980B9]"
            onClick={() => setAddKind('document')}
          >
            + {t('addDocument')}
          </button>
        ) : null}
      </div>
      {!guestId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('details.phone')}
            preset="phone"
            value={draftPhone}
            onChange={(e) => onDraftChange?.({ phone: e.target.value })}
            hint={t('summary.phoneAtCheckIn')}
          />
          <Field
            label={t('details.email')}
            preset="longText"
            value={draftEmail}
            onChange={(e) => onDraftChange?.({ email: e.target.value })}
          />
          <p className="sm:col-span-2 text-[12px] text-[#7F8C8D]">{t('summary.saveToAddLists')}</p>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-[#34495E]">{t('contacts')}</h3>
          <MiniTable
            headers={[t('grid.type'), t('grid.contact')]}
            empty={contacts.length === 0}
            emptyLabel={t('grid.empty')}
            colSpan={2}
          >
            {contacts.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.kind ? kindLabel('contactKind', r.kind) : dash}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.value || dash}</td>
              </tr>
            ))}
          </MiniTable>
          {guestId ? (
            <button
              type="button"
              className="mt-2 text-[12px] text-[#2980B9]"
              onClick={() => setAddKind('contact')}
            >
              + {t('addContact')}
            </button>
          ) : null}
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-[#34495E]">{t('addresses')}</h3>
          <MiniTable
            headers={[t('grid.type'), t('grid.address')]}
            empty={addresses.length === 0}
            emptyLabel={t('grid.empty')}
            colSpan={2}
          >
            {addresses.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.kind ? kindLabel('addressKind', r.kind) : dash}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.line1 || dash}</td>
              </tr>
            ))}
          </MiniTable>
          {guestId ? (
            <button
              type="button"
              className="mt-2 text-[12px] text-[#2980B9]"
              onClick={() => setAddKind('address')}
            >
              + {t('addAddress')}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-[#D5DADF] pt-3">
        {(
          [
            ['gdprConfirmed', gdprConfirmed, t('consent.gdpr')],
            ['smsConsent', smsConsent, t('consent.sms')],
            ['whatsappConsent', whatsappConsent, t('consent.whatsapp')],
            ['phoneConsent', phoneConsent, t('consent.phone')],
            ['emailConsent', emailConsent, t('consent.email')],
            ['callBack', callBack, t('consent.callBack')],
          ] as const
        ).map(([key, checked, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onConsent(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      {guestId && addKind ? (
        <GuestCardCollectionModal
          open
          kind={addKind}
          guestId={guestId}
          onClose={() => setAddKind(null)}
          onSaved={onReload}
        />
      ) : null}
    </div>
  );
}
