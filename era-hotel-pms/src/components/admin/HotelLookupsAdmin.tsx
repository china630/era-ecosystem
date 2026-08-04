'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

const KINDS = [
  'MARKET',
  'SEGMENT',
  'VIP_TYPE',
  'LOYALTY_TIER',
  'VISA_TYPE',
  'TITLE',
  'GENDER',
  'MARITAL_STATUS',
  'TRIP_REASON',
  'ACCOM_TYPE',
  'RECORD_TYPE',
  'SPECIAL_STATE',
  'VERIFICATION_STATUS',
  'NOTE_TYPE',
  'CONCIERGE_CATEGORY',
  'EVENT_LINE_KIND',
] as const;

type Kind = (typeof KINDS)[number];

type LookupRow = {
  id: string;
  kind: Kind;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export function HotelLookupsAdmin() {
  const t = useTranslations('masterData');
  const tc = useTranslations('common');
  const formId = useId();
  const [kind, setKind] = useState<Kind>('MARKET');
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [edit, setEdit] = useState<LookupRow | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/master/lookups?kind=${kind}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError(e);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mb-6 rounded-lg border border-[#D5DADF] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('lookups')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <FieldSelect
            label={t('lookupKind')}
            preset="selectWide"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </FieldSelect>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        </div>
      </div>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('activeStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                onClick={() => {
                  setEdit(row);
                  setOpen(true);
                }}
              >
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {row.active ? t('activeOnly') : t('inactiveOnly')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EraModal
        open={open}
        onClose={() => setOpen(false)}
        title={edit ? t('editLookup') : t('lookups')}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setOpen(false)}
            busy={busy}
            submitLabel={edit ? tc('save') : tc('add')}
          />
        }
      >
        <form
          id={formId}
          key={edit?.id ?? `new-${kind}`}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            try {
              if (edit) {
                const res = await fetch(`/api/master/lookups/${edit.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: String(fd.get('name') ?? ''),
                    active: fd.get('active') === 'on',
                    sortOrder: Number(fd.get('sortOrder') ?? 0),
                  }),
                });
                if (!res.ok) throw new Error(await res.text());
              } else {
                const res = await fetch('/api/master/lookups', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    kind,
                    code: String(fd.get('code') ?? ''),
                    name: String(fd.get('name') ?? ''),
                    sortOrder: Number(fd.get('sortOrder') ?? 0),
                  }),
                });
                if (!res.ok) throw new Error(await res.text());
              }
              showSuccess(tc('saved'));
              setOpen(false);
              await load();
            } catch (err) {
              showApiError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!edit ? (
            <Field label={t('code')} preset="code" name="code" required defaultValue="" />
          ) : (
            <Field label={t('code')} preset="code" value={edit.code} readOnly />
          )}
          <Field
            label={t('name')}
            preset="shortText"
            name="name"
            required
            defaultValue={edit?.name ?? ''}
          />
          <Field
            label={t('sortOrder')}
            preset="count"
            name="sortOrder"
            type="number"
            defaultValue={edit?.sortOrder ?? 0}
          />
          {edit ? (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={edit.active}
              />
              {t('activeStatus')}
            </label>
          ) : null}
        </form>
      </EraModal>
    </section>
  );
}
