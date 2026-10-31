'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, Pencil, Plus } from 'lucide-react';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateDisplay, bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { TourRosterModal, type TourDepartureDetail } from '@/components/tours/TourRosterModal';
import { TourDepartureStatusBadge } from '@/components/tours/tour-status-badge';

type Departure = {
  id: string;
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  meetingPoint: string;
  guideName: string | null;
  capacity: number;
  status: string;
  price: number | string;
  vehicleId: string | null;
  vehicle: { code: string; licensePlate: string } | null;
  _count?: { bookings: number };
};

type Vehicle = { id: string; code: string; licensePlate: string; active: boolean };
type Template = {
  id: string;
  code: string;
  name: string;
  defaultAgenda: string;
  defaultCapacity: number;
  defaultPrice: number | string;
};

const formId = 'tour-departure-form';
const editFormId = 'tour-departure-edit-form';
const ICON_BTN = `${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`;

export default function ToursPage() {
  const t = useTranslations('tours');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Departure[]>([]);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [date, setDate] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('09:00');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('18:00');
  const [agenda, setAgenda] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [guideName, setGuideName] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [capacity, setCapacity] = useState('20');
  const [price, setPrice] = useState('80');
  const [editAgenda, setEditAgenda] = useState('');
  const [editMeeting, setEditMeeting] = useState('');
  const [editGuide, setEditGuide] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editVehicleId, setEditVehicleId] = useState('');

  const statusOpts = useMemo(
    () => [
      { value: '', label: t('statusAll') },
      { value: 'DRAFT', label: t('statusDraft') },
      { value: 'OPEN', label: t('statusOpen') },
      { value: 'CLOSED', label: t('statusClosed') },
      { value: 'DEPARTED', label: t('statusDeparted') },
      { value: 'CANCELLED', label: t('statusCancelled') },
    ],
    [t],
  );

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const res = await fetch(`/api/tours/departures${q.toString() ? `?${q}` : ''}`);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    setRows(await res.json());
  }, [status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1') void openCreateModal();
    const roster = searchParams.get('roster');
    if (roster) setRosterId(roster);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps -- open once from query

  async function loadCatalogs() {
    const [vRes, tRes] = await Promise.all([fetch('/api/fleet/vehicles'), fetch('/api/tours/templates')]);
    if (vRes.ok) setVehicles((await vRes.json()).filter((v: Vehicle) => v.active));
    if (tRes.ok) setTemplates(await tRes.json());
  }

  async function openCreateModal() {
    setTemplateId('');
    setDate('');
    setPickupDate('');
    setPickupTime('09:00');
    setReturnDate('');
    setReturnTime('18:00');
    setAgenda('');
    setMeetingPoint('');
    setGuideName('');
    setVehicleId('');
    setCapacity('20');
    setPrice('80');
    await loadCatalogs();
    setModalOpen(true);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tmpl = templates.find((x) => x.id === id);
    if (!tmpl) return;
    setAgenda(tmpl.defaultAgenda || tmpl.name);
    setCapacity(String(tmpl.defaultCapacity));
    setPrice(String(tmpl.defaultPrice));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !pickupDate || !returnDate) {
      showApiError({ error: t('missingFields') });
      return;
    }
    setBusy(true);
    const res = await fetch('/api/tours/departures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: templateId || undefined,
        date: new Date(`${date}T12:00:00`).toISOString(),
        pickupAt: new Date(`${pickupDate}T${pickupTime}`).toISOString(),
        returnAt: new Date(`${returnDate}T${returnTime}`).toISOString(),
        agenda,
        meetingPoint,
        guideName: guideName || undefined,
        vehicleId: vehicleId || undefined,
        capacity: Number(capacity),
        price: Number(price),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data);
      return;
    }
    showSuccess(t('saved'));
    setModalOpen(false);
    await load();
    setRosterId(data.id as string);
    router.replace(`/tours?roster=${data.id}`);
  }

  async function openEditFromRow(r: Departure) {
    await loadCatalogs();
    setEditId(r.id);
    setEditAgenda(r.agenda);
    setEditMeeting(r.meetingPoint);
    setEditGuide(r.guideName ?? '');
    setEditCapacity(String(r.capacity));
    setEditPrice(String(r.price));
    setEditVehicleId(r.vehicleId ?? '');
    setEditOpen(true);
  }

  async function openEditFromRoster(dep: TourDepartureDetail) {
    await loadCatalogs();
    setEditId(dep.id);
    setEditAgenda(dep.agenda);
    setEditMeeting(dep.meetingPoint);
    setEditGuide(dep.guideName ?? '');
    setEditCapacity(String(dep.capacity));
    setEditPrice(String(dep.price));
    setEditVehicleId(dep.vehicleId ?? '');
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setBusy(true);
    const res = await fetch(`/api/tours/departures/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agenda: editAgenda,
        meetingPoint: editMeeting,
        guideName: editGuide || null,
        capacity: Number(editCapacity),
        price: Number(editPrice),
        vehicleId: editVehicleId || null,
        status: editVehicleId ? 'OPEN' : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('saved'));
    setEditOpen(false);
    await load();
  }

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      DRAFT: t('statusDraft'),
      OPEN: t('statusOpen'),
      CLOSED: t('statusClosed'),
      DEPARTED: t('statusDeparted'),
      CANCELLED: t('statusCancelled'),
    };
    return map[s] ?? s;
  }

  function closeRoster() {
    setRosterId(null);
    const q = new URLSearchParams(searchParams.toString());
    q.delete('roster');
    const qs = q.toString();
    router.replace(qs ? `/tours?${qs}` : '/tours');
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void openCreateModal()}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('newDeparture')}
          </button>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setStatus('');
          setFrom('');
          setTo('');
        }}
      >
        <DatePicker
          label={t('from')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={t('to')}
          value={to}
          onChange={setTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('status')}
          value={status}
          onChange={(v) => setStatus(String(v))}
          options={statusOpts}
        />
      </EraListFilterBar>
      <HotelDataGrid<Departure & Record<string, unknown>>
        columns={[
          {
            key: 'date',
            header: t('date'),
            render: (r) => bakuDateDisplay(r.date.slice(0, 10)),
          },
          { key: 'agenda', header: t('agenda') },
          {
            key: 'pickup',
            header: t('pickup'),
            render: (r) => bakuDateTimeDisplay(r.pickupAt),
          },
          {
            key: 'seats',
            header: t('seats'),
            render: (r) => `${r._count?.bookings ?? 0}/${r.capacity}`,
          },
          {
            key: 'vehicle',
            header: t('vehicle'),
            render: (r) => (r.vehicle ? `${r.vehicle.code}` : t('vehicleMissing')),
          },
          {
            key: 'status',
            header: t('status'),
            render: (r) => <TourDepartureStatusBadge status={r.status} label={statusLabel(r.status)} />,
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) => (
              <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={ICON_BTN}
                  title={t('open')}
                  aria-label={t('open')}
                  onClick={() => setRosterId(r.id)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                </button>
                {r.status !== 'DEPARTED' && r.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    className={ICON_BTN}
                    title={t('edit')}
                    aria-label={t('edit')}
                    onClick={() => void openEditFromRow(r)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
        onRowClick={(r) => setRosterId(r.id)}
      />

      <EraModal
        open={modalOpen}
        title={t('newDeparture')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t('save')}
          />
        }
      >
        <form id={formId} onSubmit={save} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="ENTITY_REF"
            label={t('template')}
            value={templateId}
            onChange={(v) => applyTemplate(String(v ?? ''))}
            options={templates.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))}
            emptyLabel={t('noTemplate')}
          />
          <Field
            label={t('agenda')}
            preset="longText"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            required
          />
          <DatePicker
            label={t('date')}
            value={date}
            onChange={setDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t('pickup')}
              value={pickupDate}
              onChange={setPickupDate}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />
            <Field
              label={tc('time')}
              preset="time"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t('return')}
              value={returnDate}
              onChange={setReturnDate}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />
            <Field
              label={tc('time')}
              preset="time"
              type="time"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
              required
            />
          </div>
          <Field
            label={t('meetingPoint')}
            preset="shortText"
            value={meetingPoint}
            onChange={(e) => setMeetingPoint(e.target.value)}
          />
          <Field
            label={t('guide')}
            preset="shortText"
            value={guideName}
            onChange={(e) => setGuideName(e.target.value)}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t('vehicle')}
            value={vehicleId}
            onChange={(v) => setVehicleId(String(v ?? ''))}
            options={vehicles.map((v) => ({
              value: v.id,
              label: `${v.code} ${v.licensePlate}`,
            }))}
            emptyLabel="—"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('capacity')}
              preset="code"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
            <Field
              label={t('price')}
              preset="amount"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={editOpen}
        title={t('edit')}
        onClose={() => setEditOpen(false)}
        footer={
          <EraModalFooter
            formId={editFormId}
            onCancel={() => setEditOpen(false)}
            busy={busy}
            submitLabel={t('save')}
          />
        }
      >
        <form id={editFormId} onSubmit={saveEdit} className={FORM_STACK_CLASS}>
          <Field
            label={t('agenda')}
            preset="longText"
            value={editAgenda}
            onChange={(e) => setEditAgenda(e.target.value)}
          />
          <Field
            label={t('meetingPoint')}
            preset="shortText"
            value={editMeeting}
            onChange={(e) => setEditMeeting(e.target.value)}
          />
          <Field
            label={t('guide')}
            preset="shortText"
            value={editGuide}
            onChange={(e) => setEditGuide(e.target.value)}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t('vehicle')}
            value={editVehicleId}
            onChange={(v) => setEditVehicleId(String(v ?? ''))}
            options={vehicles.map((v) => ({ value: v.id, label: `${v.code} ${v.licensePlate}` }))}
            emptyLabel="—"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('capacity')}
              preset="code"
              type="number"
              value={editCapacity}
              onChange={(e) => setEditCapacity(e.target.value)}
            />
            <Field
              label={t('price')}
              preset="amount"
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
          </div>
        </form>
      </EraModal>

      <TourRosterModal
        open={!!rosterId}
        departureId={rosterId}
        onClose={closeRoster}
        onEdit={(dep) => void openEditFromRoster(dep)}
        onChanged={() => void load()}
      />
    </div>
  );
}
