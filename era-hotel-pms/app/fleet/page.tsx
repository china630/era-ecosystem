'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CatalogField,
  EraListFilterBar,
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type Vehicle = {
  id: string;
  code: string;
  brand: string;
  licensePlate: string;
  driverName: string | null;
  driverPhone: string | null;
  maxSeats: number;
  active: boolean;
};

const formId = 'fleet-vehicle-form';

export default function FleetPage() {
  const t = useTranslations('fleet');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [activeFilter, setActiveFilter] = useState('true');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('');
  const [licensePlate, setPlate] = useState('');
  const [driverName, setDriver] = useState('');
  const [driverPhone, setPhone] = useState('');
  const [maxSeats, setSeats] = useState('18');

  const load = useCallback(async () => {
    const res = await fetch('/api/fleet/vehicles');
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    setRows(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (activeFilter === 'true') return rows.filter((r) => r.active);
    if (activeFilter === 'false') return rows.filter((r) => !r.active);
    return rows;
  }, [rows, activeFilter]);

  function openCreate() {
    setEditId(null);
    setCode('');
    setBrand('');
    setPlate('');
    setDriver('');
    setPhone('');
    setSeats('18');
    setOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditId(v.id);
    setCode(v.code);
    setBrand(v.brand);
    setPlate(v.licensePlate);
    setDriver(v.driverName ?? '');
    setPhone(v.driverPhone ?? '');
    setSeats(String(v.maxSeats));
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = editId
      ? await fetch(`/api/fleet/vehicles/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand,
            licensePlate,
            driverName: driverName || null,
            driverPhone: driverPhone || null,
            maxSeats: Number(maxSeats),
          }),
        })
      : await fetch('/api/fleet/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            brand,
            licensePlate,
            driverName,
            driverPhone,
            maxSeats: Number(maxSeats),
          }),
        });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(tc('saved'));
    setOpen(false);
    await load();
  }

  async function setActive(id: string, active: boolean) {
    const res = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(active ? t('reactivated') : t('retired'));
    await load();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('add')}
          </button>
        }
      />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setActiveFilter('true')}>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('active')}
          value={activeFilter}
          onChange={(v) => setActiveFilter(String(v))}
          options={[
            { value: 'true', label: t('activeOnly') },
            { value: 'false', label: t('retiredOnly') },
            { value: '', label: t('allVehicles') },
          ]}
        />
      </EraListFilterBar>
      <HotelDataGrid<Vehicle & Record<string, unknown>>
        columns={[
          { key: 'code', header: t('code') },
          { key: 'brand', header: t('brand') },
          { key: 'licensePlate', header: t('plate') },
          { key: 'maxSeats', header: t('seats') },
          {
            key: 'driver',
            header: t('driver'),
            render: (v) => v.driverName ?? '—',
          },
          {
            key: 'active',
            header: t('active'),
            render: (v) => (v.active ? t('active') : t('retire')),
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (v) => (
              <div className="flex flex-wrap gap-1">
                <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => openEdit(v)}>
                  {tc('edit')}
                </button>
                {v.active ? (
                  <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void setActive(v.id, false)}>
                    {t('retire')}
                  </button>
                ) : (
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void setActive(v.id, true)}>
                    {t('reactivate')}
                  </button>
                )}
              </div>
            ),
          },
        ]}
        rows={visible}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />

      <EraModal
        open={open}
        title={editId ? t('edit') : t('add')}
        onClose={() => setOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setOpen(false)}
            busy={busy}
            submitLabel={editId ? tc('save') : t('add')}
          />
        }
      >
        <form id={formId} onSubmit={save} className={FORM_STACK_CLASS}>
          {!editId ? (
            <Field label={t('code')} preset="code" value={code} onChange={(e) => setCode(e.target.value)} required />
          ) : null}
          <Field label={t('brand')} preset="shortText" value={brand} onChange={(e) => setBrand(e.target.value)} required />
          <Field
            label={t('plate')}
            preset="code"
            value={licensePlate}
            onChange={(e) => setPlate(e.target.value)}
            required
          />
          <Field
            label={t('driver')}
            preset="shortText"
            value={driverName}
            onChange={(e) => setDriver(e.target.value)}
          />
          <Field
            label={t('phone')}
            preset="shortText"
            value={driverPhone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Field
            label={t('seats')}
            preset="code"
            type="number"
            min={1}
            value={maxSeats}
            onChange={(e) => setSeats(e.target.value)}
            required
          />
        </form>
      </EraModal>
    </div>
  );
}
