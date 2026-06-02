'use client';

import { useTranslations } from 'next-intl';
import { EraDataGrid, MODAL_INPUT_CLASS } from '@era/satellite-kit/ui';

export function GuestCardIdentityTab({
  guestId,
  documents,
  contacts,
  addresses,
  phone,
  email,
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
  phone: string;
  email: string;
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

  return (
    <div className="space-y-4 text-[13px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          {t('details.phone')}
          <input className={MODAL_INPUT_CLASS} value={phone} readOnly />
        </label>
        <label>
          {t('details.email')}
          <input className={MODAL_INPUT_CLASS} value={email} readOnly />
        </label>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-[#34495E]">{t('documents')}</h3>
        <EraDataGrid
          rows={documents as Array<Record<string, unknown>>}
          columns={[
            { key: 'docType', header: t('grid.type') },
            { key: 'docNumber', header: t('grid.number') },
            { key: 'serialNo', header: t('grid.serial') },
            { key: 'issuingAuthority', header: t('grid.issuer') },
            { key: 'nationality', header: t('grid.nationality') },
            { key: 'issuePlace', header: t('grid.issuePlace') },
            {
              key: 'isPrimary',
              header: t('grid.primary'),
              render: (r) => (r.isPrimary ? '✓' : '—'),
            },
          ]}
          rowKey={(r) => String(r.id)}
          emptyMessage="—"
        />
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
          <EraDataGrid
            rows={contacts as Array<Record<string, unknown>>}
            columns={[
              { key: 'kind', header: t('grid.type') },
              { key: 'value', header: t('grid.contact') },
            ]}
            rowKey={(r) => String(r.id)}
            emptyMessage="—"
          />
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
          <EraDataGrid
            rows={addresses as Array<Record<string, unknown>>}
            columns={[
              { key: 'kind', header: t('grid.type') },
              { key: 'line1', header: t('grid.address') },
            ]}
            rowKey={(r) => String(r.id)}
            emptyMessage="—"
          />
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
            <input type="checkbox" checked={checked} onChange={(e) => onConsent(key, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
