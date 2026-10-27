'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
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
type Person = {
  id: string;
  globalPersonId: string;
  name: string;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  positionName?: string | null;
};

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
  const [orgUnitId, setOrgUnitId] = useState('');
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

  const orgUnitOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) {
      if (person.orgUnitId && person.orgUnitName) map.set(person.orgUnitId, person.orgUnitName);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [people]);

  const options = useMemo(() => {
    const linkedIds = new Set(
      rows.map((r) => r.globalPersonId).filter((id): id is string => Boolean(id)),
    );
    return people
      .filter((p) => !linkedIds.has(p.globalPersonId))
      .filter((p) => !orgUnitId || p.orgUnitId === orgUnitId)
      .map((p) => ({
        value: p.globalPersonId,
        label: p.positionName ? `${p.name} (${p.positionName})` : p.name,
      }));
  }, [people, rows, orgUnitId]);

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
    setOrgUnitId('');
    await load();
  }

  async function changeDept(id: string, next: string) {
    if (!(DEPTS as readonly string[]).includes(next)) return;
    const res = await fetch('/api/housekeeping/maids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, department: next }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else {
      showSuccess(tc('saved'));
      await load();
    }
  }

  async function unlink(id: string) {
    const res = await fetch('/api/housekeeping/maids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: false }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else {
      showSuccess(t('unlinked'));
      await load();
    }
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
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={unavailable}
              onClick={() => {
                setOrgUnitId('');
                setPersonId('');
                setDepartment('ROOMS');
                setOpen(true);
              }}
            >
              {tc('add')}
            </button>
          ) : null
        }
      />
      {unavailable ? <p className="mb-3 text-sm text-amber-800">{t('personnelUnavailable')}</p> : null}
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
              <th className="px-3 py-2">{t('name')}</th>
              <th className="px-3 py-2">{t('department')}</th>
              <th className="px-3 py-2">{th('accrueEg')}</th>
              <th className="px-3 py-2">{t('tasks')}</th>
              {canWrite ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-b border-[#ECF0F1]">
                <td className="px-3 py-3 text-[#7F8C8D]" colSpan={canWrite ? 5 : 4}>
                  {t('empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#ECF0F1]">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <CatalogField
                        kind="CLOSED_SMALL"
                        label={t('department')}
                        value={r.department}
                        onChange={(v) => void changeDept(r.id, String(v))}
                        options={DEPTS.map((d) => ({ value: d, label: th(`dept.${d}`) }))}
                        className="!space-y-0 min-w-[9rem]"
                      />
                    ) : (
                      deptLabel(r.department)
                    )}
                  </td>
                  <td className="px-3 py-2">{r.egBalance ?? 0}</td>
                  <td className="px-3 py-2">{r.tasks?.length ?? 0}</td>
                  {canWrite ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void unlink(r.id)}
                      >
                        {t('unlink')}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
            kind="CLOSED_MEDIUM"
            label={t('orgUnit')}
            value={orgUnitId}
            onChange={(v) => {
              setOrgUnitId(String(v));
              setPersonId('');
            }}
            options={orgUnitOptions}
            emptyLabel={t('orgUnitAll')}
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t('pickEmployee')}
            value={personId}
            onChange={(v) => setPersonId(String(v))}
            options={options}
            emptyLabel={unavailable ? t('personnelUnavailable') : t('pickEmployeeEmpty')}
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
