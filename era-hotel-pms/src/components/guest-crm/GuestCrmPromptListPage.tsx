'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldTextarea,
  ModalShell,
  ModalFooter,
  showApiError,
  showSuccess,
  type FieldWidthPreset,
} from '@era/satellite-kit/ui';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';

export type GuestCrmAddField = {
  name: string;
  label: string;
  preset?: FieldWidthPreset;
  required?: boolean;
  multiline?: boolean;
  defaultValue?: string;
  placeholder?: string;
};

type Props = {
  titleKey: string;
  apiPath: (guestId: string) => string;
  addFields: GuestCrmAddField[];
  buildBody: (values: Record<string, string>) => Record<string, unknown>;
  postPath?: (guestId: string) => string;
  searchKeys?: string[];
  addLabelKey?: string;
  renderItem: (row: Record<string, unknown>) => ReactNode;
};

function defaultsFromFields(fields: GuestCrmAddField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) out[f.name] = f.defaultValue ?? '';
  return out;
}

function rowMatches(row: Record<string, unknown>, q: string, searchKeys?: string[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const keys = searchKeys?.length ? searchKeys : Object.keys(row);
  return keys.some((k) => {
    const v = row[k];
    if (v == null) return false;
    if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(needle);
    return String(v).toLowerCase().includes(needle);
  });
}

export function GuestCrmPromptListPage({
  titleKey,
  apiPath,
  addFields,
  buildBody,
  postPath,
  searchKeys,
  addLabelKey = 'crmPages.add',
  renderItem,
}: Props) {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const { rows, reload } = useGuestCrmList(apiPath(id));

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => defaultsFromFields(addFields));
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => rows.filter((r) => rowMatches(r, debouncedQ, searchKeys)),
    [rows, debouncedQ, searchKeys],
  );

  function openModal() {
    setValues(defaultsFromFields(addFields));
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  async function submit() {
    for (const f of addFields) {
      if (f.required && !values[f.name]?.trim()) {
        showApiError({ error: tc('required') });
        return;
      }
    }
    setBusy(true);
    try {
      const url = (postPath ?? ((gid: string) => apiPath(gid).split('?')[0]!))(id);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(values)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setOpen(false);
      await reload();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t(titleKey as 'crmPages.preferencesTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openModal}>
            {t(addLabelKey as 'crmPages.add')}
          </button>
        }
      />

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={`${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]`}>
          {filtered.map((r) => renderItem(r))}
        </ul>
      )}

      <ModalShell
        open={open}
        title={t(addLabelKey as 'crmPages.add')}
        onClose={closeModal}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={closeModal}
            onSubmit={() => void submit()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <div className="space-y-3">
          {addFields.map((f) =>
            f.multiline ? (
              <FieldTextarea
                key={f.name}
                label={f.label}
                required={f.required}
                placeholder={f.placeholder}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
              />
            ) : (
              <Field
                key={f.name}
                label={f.label}
                preset={f.preset ?? 'longText'}
                required={f.required}
                placeholder={f.placeholder}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
              />
            ),
          )}
        </div>
      </ModalShell>
    </>
  );
}
