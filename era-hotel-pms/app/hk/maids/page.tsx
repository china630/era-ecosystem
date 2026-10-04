'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Maid = {
  id: string;
  name: string;
  department: string;
  globalPersonId?: string | null;
  egBalance?: number;
  tasks?: unknown[];
};
type Person = { id: string; globalPersonId: string; name: string };

const DEPTS = ['ROOMS', 'PUBLIC_AREA', 'LAUNDRY'] as const;

export default function MaidsPage() {
  const { can } = useAuth();
  const t = useTranslations('maidManagement');
  const th = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const canWrite = can(PERMISSIONS.HOUSEKEEPING_MANAGE);
  const [rows, setRows] = useState<Maid[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState('');
  const [department, setDepartment] = useState('ROOMS');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      fetch('/api/housekeeping/maids'),
      fetch('/api/housekeeping/personnel'),
    ]);
    const mJson = await mRes.json();
    if (!mRes.ok) showApiError(mJson, tc('loadError'));
    else setRows(Array.isArray(mJson) ? mJson : []);
    const pJson = await pRes.json().catch(() => ({}));
    if (pRes.ok) {
      setPeople(Array.isArray(pJson.items) ? pJson.items : []);
      setUnavailable(Boolean(pJson.unavailable));
    } else {
      setPeople([]);
      setUnavailable(true);
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const linked = new Set(rows.map((r) => r.globalPersonId).filter((id): id is string => Boolean(id)));
  const options = people
    .filter((p) => !linked.has(p.globalPersonId))
    .map((p) => ({ value: p.globalPersonId, label: p.name }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const person = people.find((p) => p.globalPersonId === personId);
    if (!person) return;
    setBusy(true);
    const res = await fetch('/api/housekeeping/maids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        globalPersonId: person.globalPersonId,
        name: person.name,
        department,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(json, tc('failed'));
      return;
    }
    showSuccess(tc('saved'));
    setOpen(false);
    setPersonId('');
    await load();
  }

  function deptLabel(code: string) {
    if (code === 'ROOMS' || code === 'PUBLIC_AREA' || code === 'LAUNDRY') return th(`dept.${code}`);
    return code;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('hint')}
        actions={
          canWrite ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
              {tc('add')}
            </button>
          ) : null
        }
      />
      {unavailable ? <p className="mb-3 text-sm text-amber-800">{t('personnelUnavailable')}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t('empty')}</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
                <th className="px-3 py-2">{t('name')}</th>
                <th className="px-3 py-2">{t('department')}</th>
                <th className="px-3 py-2">{th('accrueEg')}</th>
                <th className="px-3 py-2">{t('tasks')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#ECF0F1]">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{deptLabel(r.department)}</td>
                  <td className="px-3 py-2">{r.egBalance ?? 0}</td>
                  <td className="px-3 py-2">{r.tasks?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <EraModal
        open={open}
        title={tc('add')}
        onClose={() => setOpen(false)}
        footer={
          <EraModalFooter formId="maid-link" onCancel={() => setOpen(false)} busy={busy} submitLabel={tc('save')} />
        }
      >
        <form id="maid-link" onSubmit={save} className="space-y-3">
          <CatalogField
            kind="SEARCHABLE"
            label={t('pickEmployee')}
            value={personId}
            onChange={(v) => setPersonId(String(v))}
            options={options}
            emptyLabel={unavailable ? t('personnelUnavailable') : t('empty')}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('department')}
            value={department}
            onChange={(v) => setDepartment(String(v))}
            options={DEPTS.map((d) => ({ value: d, label: th(`dept.${d}`) }))}
          />
        </form>
      </EraModal>
    </>
  );
}
