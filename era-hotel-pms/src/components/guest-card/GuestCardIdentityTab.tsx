'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
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
    <div className="overflow-x-auto rounded border border-[#D5DADF]">
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
}) {
  const t = useTranslations('guestCard');
  const dash = '—';

  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <h3 className="mb-2 font-semibold text-[#34495E]">{t('documents')}</h3>
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
              <td className={DATA_TABLE_TD_CLASS}>{r.docType || dash}</td>
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
            onClick={async () => {
              const docType = window.prompt(t('grid.type'), 'PASSPORT');
              const docNumber = window.prompt(t('grid.number'));
              if (!docType || !docNumber) return;
              await fetch(`/api/guests/${guestId}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docType, docNumber }),
              });
              onReload();
            }}
          >
            + {t('addDocument')}
          </button>
        ) : null}
      </div>
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
                <td className={DATA_TABLE_TD_CLASS}>{r.kind || dash}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.value || dash}</td>
              </tr>
            ))}
          </MiniTable>
          {guestId ? (
            <button
              type="button"
              className="mt-2 text-[12px] text-[#2980B9]"
              onClick={async () => {
                const kind = window.prompt(t('grid.type'), 'MOBILE');
                const value = window.prompt(t('grid.contact'));
                if (!kind || !value) return;
                await fetch(`/api/guests/${guestId}/contacts`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind, value }),
                });
                onReload();
              }}
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
                <td className={DATA_TABLE_TD_CLASS}>{r.kind || dash}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.line1 || dash}</td>
              </tr>
            ))}
          </MiniTable>
          {guestId ? (
            <button
              type="button"
              className="mt-2 text-[12px] text-[#2980B9]"
              onClick={async () => {
                const kind = window.prompt(t('grid.type'), 'HOME');
                const line1 = window.prompt(t('grid.address'));
                if (!kind || !line1) return;
                await fetch(`/api/guests/${guestId}/addresses`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind, line1 }),
                });
                onReload();
              }}
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
    </div>
  );
}
