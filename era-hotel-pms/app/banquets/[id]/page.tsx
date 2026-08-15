'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Tab = 'lines' | 'resources' | 'staff' | 'settlement';

export default function BanquetDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const t = useTranslations('banquets');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<Tab>('lines');
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [staff, setStaff] = useState<Array<Record<string, unknown>>>([]);
  const [lineDesc, setLineDesc] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('100');
  const [staffRole, setStaffRole] = useState('WAITER');
  const [staffName, setStaffName] = useState('');
  const [saloons, setSaloons] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [resourceSaloonId, setResourceSaloonId] = useState('');
  const [resourceLabel, setResourceLabel] = useState('');
  const [resourceStartDate, setResourceStartDate] = useState('');
  const [resourceStartTime, setResourceStartTime] = useState('10:00');
  const [resourceEndDate, setResourceEndDate] = useState('');
  const [resourceEndTime, setResourceEndTime] = useState('12:00');
  const [preferredFolioType, setPreferredFolioType] = useState<'GUEST' | 'COMPANY' | 'AGENCY'>(
    'GUEST',
  );

  const load = useCallback(async () => {
    const id = params.id;
    const [evRes, stRes, setRes, banquetRes] = await Promise.all([
      fetch(`/api/banquets/${id}`),
      fetch(`/api/banquets/${id}/staff`),
      fetch(`/api/banquets/${id}/settlement`),
      fetch('/api/banquets'),
    ]);
    setEvent(await evRes.json());
    setStaff(await stRes.json());
    setSettlement(await setRes.json());
    const banquetData = await banquetRes.json();
    const list = banquetData.saloons ?? [];
    setSaloons(list);
    if (!resourceSaloonId && list[0]?.id) setResourceSaloonId(list[0].id);
  }, [params.id, resourceSaloonId]);

  useEffect(() => {
    if (can(PERMISSIONS.RESERVATIONS_READ)) void load();
  }, [can, load]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/banquets/${params.id}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'EQUIPMENT',
        description: lineDesc,
        quantity: Number(lineQty),
        unitPrice: Number(linePrice),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('lineAdded'));
    setLineDesc('');
    await load();
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/banquets/${params.id}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: staffRole, staffName }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('staffAdded'));
    setStaffName('');
    await load();
  }

  async function addResource(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceStartDate || !resourceStartTime || !resourceEndDate || !resourceEndTime) {
      showApiError({ error: t('resourceMissingTimes') });
      return;
    }
    const res = await fetch(`/api/banquets/${params.id}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saloonId: resourceSaloonId || undefined,
        label: resourceLabel || undefined,
        startAt: new Date(`${resourceStartDate}T${resourceStartTime}`).toISOString(),
        endAt: new Date(`${resourceEndDate}T${resourceEndTime}`).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('resourceAdded'));
    setResourceLabel('');
    await load();
  }

  async function confirmEvent() {
    const res = await fetch(`/api/banquets/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', preferredFolioType }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('confirmed'));
    await load();
  }

  function printDaySheetHtml(data: Record<string, unknown>) {
    const lines = (data.lines as Array<Record<string, unknown>> | undefined) ?? [];
    const resources = (data.resources as Array<Record<string, unknown>> | undefined) ?? [];
    const staff = (data.staff as Array<Record<string, unknown>> | undefined) ?? [];
    const esc = (v: unknown) =>
      String(v ?? '—')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const lineRows = lines
      .map(
        (l) =>
          `<tr><td>${esc(l.description)}</td><td>${esc(l.qty)}</td><td>${esc(l.unitPrice)}</td><td>${esc(l.kind)}</td></tr>`,
      )
      .join('');
    const resourceRows = resources
      .map(
        (r) =>
          `<tr><td>${esc(r.label)}</td><td>${esc(r.startAt && new Date(String(r.startAt)).toLocaleString())}</td><td>${esc(r.endAt && new Date(String(r.endAt)).toLocaleString())}</td><td>${esc(r.notes)}</td></tr>`,
      )
      .join('');
    const staffRows = staff
      .map(
        (s) =>
          `<tr><td>${esc(s.role)}</td><td>${esc(s.staffName)}</td><td>${esc(s.notes)}</td></tr>`,
      )
      .join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${esc(data.eventName)} — BEO</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#222;max-width:900px;margin:0 auto}
        h1{font-size:20px;margin:0 0 4px} .meta{font-size:13px;color:#555;margin-bottom:16px}
        h2{font-size:14px;margin:18px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f5f5f5}
        .folio{margin-top:12px;font-size:12px}
        @media print{button{display:none}}
      </style></head><body>
      <h1>${esc(data.eventName)}</h1>
      <div class="meta">
        ${esc(data.referenceNo)} · ${esc(data.eventDate && new Date(String(data.eventDate)).toLocaleDateString())}
        · ${esc(data.status)} · pax ${esc(data.pax)} · ${esc(data.saloon)}
        · contact ${esc(data.contactName)}
      </div>
      <h2>${t('tab.lines')}</h2>
      <table><thead><tr><th>${t('lineDescription')}</th><th>${t('lineQty')}</th><th>${t('linePrice')}</th><th>Kind</th></tr></thead>
      <tbody>${lineRows || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <h2>${t('tab.resources')}</h2>
      <table><thead><tr><th>${t('resourceLabel')}</th><th>${t('resourceStart')}</th><th>${t('resourceEnd')}</th><th>${t('notes')}</th></tr></thead>
      <tbody>${resourceRows || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <h2>${t('tab.staff')}</h2>
      <table><thead><tr><th>Role</th><th>Name</th><th>${t('notes')}</th></tr></thead>
      <tbody>${staffRows || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
      <div class="folio">${t('masterFolio')}: ${esc(data.masterFolioId)} · reservation ${esc(data.reservationId)}</div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  const orderLines = (event?.orderLines as Array<Record<string, unknown>>) ?? [];

  return (
    <>
      <PageHeader
        title={(event?.eventName as string) ?? t('detail')}
        subtitle={event?.eventDate ? new Date(String(event.eventDate)).toLocaleDateString() : ''}
        actions={
          <div className="flex gap-2">
            <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
              {tc('back')}
            </Link>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/banquets/${params.id}/day-sheet`);
                  const data = await res.json();
                  if (!res.ok) {
                    showApiError(data, tc('error'));
                    return;
                  }
                  printDaySheetHtml(data as Record<string, unknown>);
                } catch (e) {
                  showApiError({ error: e instanceof Error ? e.message : tc('error') });
                }
              }}
            >
              {t('printDaySheet')}
            </button>
            {event?.status === 'DRAFT' && can(PERMISSIONS.RESERVATIONS_WRITE) && (
              <>
                <FieldSelect
                  label={t('preferredFolio')}
                  preset="select"
                  value={preferredFolioType}
                  onChange={(e) =>
                    setPreferredFolioType(e.target.value as 'GUEST' | 'COMPANY' | 'AGENCY')
                  }
                >
                  <option value="GUEST">GUEST</option>
                  <option value="COMPANY">COMPANY</option>
                  <option value="AGENCY">AGENCY</option>
                </FieldSelect>
                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={confirmEvent}>
                  {t('confirm')}
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex gap-2 border-b border-[#ECF0F1]">
        {(['lines', 'resources', 'staff', 'settlement'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-2 text-sm ${tab === key ? 'border-b-2 border-[#3498DB] font-semibold' : 'text-[#7F8C8D]'}`}
            onClick={() => setTab(key)}
          >
            {t(`tab.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'lines' && (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <table className="mb-4 w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[#7F8C8D]">
                <th className="py-2">{t('lineDescription')}</th>
                <th className="py-2">{t('lineQty')}</th>
                <th className="py-2">{t('linePrice')}</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((l) => (
                <tr key={String(l.id)} className="border-b">
                  <td className="py-2">{String(l.description)}</td>
                  <td className="py-2">{String(l.quantity)}</td>
                  <td className="py-2">{String(l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {event?.status === 'DRAFT' && (
            <form onSubmit={addLine} className={`${FORM_STACK_CLASS} max-w-md`}>
              <Field
                label={t('lineDescription')}
                preset="longText"
                value={lineDesc}
                onChange={(e) => setLineDesc(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('lineQty')}
                  preset="count"
                  type="number"
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                />
                <Field
                  label={t('linePrice')}
                  preset="amount"
                  type="number"
                  value={linePrice}
                  onChange={(e) => setLinePrice(e.target.value)}
                />
              </div>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {t('addLine')}
              </button>
            </form>
          )}
        </section>
      )}

      {tab === 'resources' && (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="text-sm text-[#7F8C8D]">{t('resourcesHint')}</p>
          <Link href="/banquets/calendar" className="mt-3 inline-block text-sm text-[#3498DB] underline">
            {t('openCalendar')}
          </Link>
          <ul className="mt-4 space-y-2 text-sm">
            {((event?.resourceBookings as Array<{ id: string; label?: string | null; startAt: string; endAt?: string; saloon?: { name: string } | null }>) ?? []).map((b) => (
              <li key={b.id}>
                {b.label ?? b.saloon?.name ?? 'Resource'} —{' '}
                {new Date(b.startAt).toLocaleString()}
                {b.endAt ? ` → ${new Date(b.endAt).toLocaleString()}` : ''}
              </li>
            ))}
          </ul>
          {event?.status === 'DRAFT' && can(PERMISSIONS.RESERVATIONS_WRITE) && (
            <form onSubmit={addResource} className={`${FORM_STACK_CLASS} mt-6 max-w-md`}>
              <FieldSelect
                label={t('saloon')}
                preset="selectWide"
                value={resourceSaloonId}
                onChange={(e) => setResourceSaloonId(e.target.value)}
              >
                {saloons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </FieldSelect>
              <Field
                label={t('resourceLabel')}
                preset="longText"
                value={resourceLabel}
                onChange={(e) => setResourceLabel(e.target.value)}
                placeholder={t('resourceLabelPlaceholder')}
              />
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label={t('resourceStart')}
                  value={resourceStartDate}
                  onChange={setResourceStartDate}
                  placeholder={tc('datePlaceholder')}
                  openCalendarLabel={tc('openCalendar')}
                  required
                />
                <Field
                  label={tc('time')}
                  preset="time"
                  type="time"
                  value={resourceStartTime}
                  onChange={(e) => setResourceStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label={t('resourceEnd')}
                  value={resourceEndDate}
                  onChange={setResourceEndDate}
                  placeholder={tc('datePlaceholder')}
                  openCalendarLabel={tc('openCalendar')}
                  required
                />
                <Field
                  label={tc('time')}
                  preset="time"
                  type="time"
                  value={resourceEndTime}
                  onChange={(e) => setResourceEndTime(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {t('addResource')}
              </button>
            </form>
          )}
        </section>
      )}

      {tab === 'staff' && (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <ul className="mb-4 space-y-2 text-sm">
            {staff.map((s) => (
              <li key={String(s.id)}>
                {String(s.role)} — {String(s.staffName)} ({String(s.status)})
              </li>
            ))}
          </ul>
          {event?.status === 'DRAFT' && (
            <form onSubmit={addStaff} className={`${FORM_STACK_CLASS} max-w-md`}>
              <Field
                label={t('staffRole')}
                preset="shortText"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
              />
              <Field
                label={t('staffName')}
                preset="longText"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                required
              />
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {t('addStaff')}
              </button>
            </form>
          )}
        </section>
      )}

      {tab === 'settlement' && settlement && (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('settlementVsFolioHint')}</p>
          <dl className="grid max-w-md grid-cols-2 gap-3 text-sm">
            <dt className="text-[#7F8C8D]">{t('plannedRevenue')}</dt>
            <dd>{String(settlement.plannedRevenue)} AZN</dd>
            <dt className="text-[#7F8C8D]">{t('actualRevenue')}</dt>
            <dd>{String(settlement.actualRevenue)} AZN</dd>
            <dt className="text-[#7F8C8D]">{t('variance')}</dt>
            <dd>{String(settlement.variance)} AZN</dd>
            <dt className="text-[#7F8C8D]">{t('posPolicy')}</dt>
            <dd>{String(settlement.extrasPolicy)}</dd>
          </dl>
        </section>
      )}
    </>
  );
}
