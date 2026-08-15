'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  FieldRow,
  FieldSelect,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Agency = { id: string; code: string; name: string };
type RoomType = { id: string; code: string; name: string };
type RatePlan = { id: string; code: string; name: string };
type BlockLine = {
  id: string;
  roomTypeId: string;
  quantity: number;
  ratePlanId: string | null;
  roomType: RoomType;
};
type Block = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  validFrom: string;
  validTo: string;
  cutoffDate: string | null;
  agency: Agency | null;
  lines: BlockLine[];
  _count: { bookings: number };
};

type GuestOpt = { id: string; fullName: string };
type PickupLine = {
  roomTypeId: string;
  roomTypeCode: string;
  quantity: number;
  picked: number;
  remaining: number;
};

export default function AllotmentBlocksPage() {
  const { can } = useAuth();
  const t = useTranslations('allotmentBlocks');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Block[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [guests, setGuests] = useState<GuestOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [pickupBlock, setPickupBlock] = useState<Block | null>(null);
  const [pickupLines, setPickupLines] = useState<PickupLine[]>([]);
  const [pickupCode, setPickupCode] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [pickupGuestId, setPickupGuestId] = useState('');
  const [pickupFolioMode, setPickupFolioMode] = useState('MASTER');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [status, setStatus] = useState('TENTATIVE');
  const [lineRoomTypeId, setLineRoomTypeId] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [lineRatePlanId, setLineRatePlanId] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/allotment-blocks');
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('failed'));
      return;
    }
    setRows(Array.isArray(data) ? data : (data.data ?? []));
  }, [tc]);

  useEffect(() => {
    void load();
    void Promise.all([
      fetch('/api/agencies').then((r) => r.json()),
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
    ]).then(([a, rt, rp, g]) => {
      setAgencies(Array.isArray(a) ? a : (a.data ?? []));
      setRoomTypes(Array.isArray(rt) ? rt : (rt.data ?? []));
      setRatePlans(Array.isArray(rp) ? rp : (rp.data ?? []));
      const glist = Array.isArray(g) ? g : (g.data ?? []);
      setGuests(
        glist.map((x: { id: string; fullName: string }) => ({ id: x.id, fullName: x.fullName })),
      );
    });
  }, [load]);

  async function openPickup(block: Block) {
    setPickupBlock(block);
    setPickupCode(`${block.code}-PK`);
    setPickupName(block.name ?? '');
    setPickupGuestId('');
    setPickupFolioMode('MASTER');
    const res = await fetch(`/api/admin/allotment-blocks/${block.id}?pickup=1`);
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('failed'));
      setPickupBlock(null);
      return;
    }
    setPickupLines(Array.isArray(data.lines) ? data.lines : []);
  }

  async function runPickup() {
    if (!pickupBlock || !pickupCode.trim() || !pickupGuestId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/allotment-blocks/${pickupBlock.id}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCode: pickupCode.trim(),
          bookingName: pickupName.trim() || undefined,
          guestId: pickupGuestId,
          folioMode: pickupFolioMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('pickupDone', { count: data.stayCount ?? data.stays?.length ?? 0 }));
      setPickupBlock(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!code.trim() || !validFrom || !validTo || !lineRoomTypeId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/allotment-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim() || undefined,
          status,
          agencyId: agencyId || undefined,
          validFrom,
          validTo,
          cutoffDate: cutoffDate || undefined,
          lines: [
            {
              roomTypeId: lineRoomTypeId,
              quantity: Number(lineQty) || 1,
              ratePlanId: lineRatePlanId || undefined,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setOpen(false);
      setCode('');
      setName('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        actions={
          can(PERMISSIONS.MASTER_DATA_MANAGE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
              <Plus className="mr-1 inline h-4 w-4" />
              {t('create')}
            </button>
          ) : null
        }
      />
      <p className="text-[13px] text-[#7F8C8D]">{t('subtitle')}</p>
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setFilterQ('');
          setFilterStatus('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
        />
        <FieldSelect
          label={t('status')}
          preset="select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{tc('all')}</option>
          <option value="TENTATIVE">TENTATIVE</option>
          <option value="DEFINITE">DEFINITE</option>
          <option value="CANCELLED">CANCELLED</option>
        </FieldSelect>
      </EraListFilterBar>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('status')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agency')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('dates')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('rooms')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('bookings')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const filtered = rows.filter((b) => {
                if (filterStatus && b.status !== filterStatus) return false;
                if (!filterQ.trim()) return true;
                const q = filterQ.trim().toLowerCase();
                return (
                  b.code.toLowerCase().includes(q) ||
                  (b.name ?? '').toLowerCase().includes(q) ||
                  (b.agency?.code ?? '').toLowerCase().includes(q)
                );
              });
              if (filtered.length === 0) {
                return (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={8} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                      {rows.length === 0 ? t('empty') : t('emptyFiltered')}
                    </td>
                  </tr>
                );
              }
              return filtered.map((b) => (
              <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{b.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{b.name ?? '—'}</td>
                <td className={DATA_TABLE_TD_CLASS}>{b.status}</td>
                <td className={DATA_TABLE_TD_CLASS}>{b.agency?.code ?? '—'}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {String(b.validFrom).slice(0, 10)} → {String(b.validTo).slice(0, 10)}
                  {b.cutoffDate ? ` · cutoff ${String(b.cutoffDate).slice(0, 10)}` : ''}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {b.lines.map((l) => `${l.roomType.code}×${l.quantity}`).join(', ')}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{b._count.bookings}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {can(PERMISSIONS.MASTER_DATA_MANAGE) &&
                  (b.status === 'TENTATIVE' || b.status === 'DEFINITE') ? (
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void openPickup(b)}
                    >
                      {t('pickup')}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>

      <EraModal
        open={open}
        title={t('create')}
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-lg w-full"
        footer={
          <EraModalFooter
            onCancel={() => setOpen(false)}
            onSubmit={() => void create()}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field label={t('code')} preset="code" value={code} onChange={(e) => setCode(e.target.value)} required />
            <FieldSelect label={t('status')} preset="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="TENTATIVE">TENTATIVE</option>
              <option value="DEFINITE">DEFINITE</option>
            </FieldSelect>
          </FieldRow>
          <Field label={t('name')} preset="shortText" value={name} onChange={(e) => setName(e.target.value)} />
          <FieldSelect
            label={t('agency')}
            preset="selectWide"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            <option value="">—</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </FieldSelect>
          <FieldRow cols={2}>
            <DatePicker
              label={t('validFrom')}
              fluid
              value={validFrom}
              onChange={setValidFrom}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
            <DatePicker
              label={t('validTo')}
              fluid
              value={validTo}
              onChange={setValidTo}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
          </FieldRow>
          <DatePicker
            label={t('cutoffDate')}
            fluid
            value={cutoffDate}
            onChange={setCutoffDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
          <FieldRow cols={3}>
            <FieldSelect
              label={t('roomType')}
              preset="select"
              value={lineRoomTypeId}
              onChange={(e) => setLineRoomTypeId(e.target.value)}
              required
            >
              <option value="">{tc('select')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </FieldSelect>
            <Field
              label={t('quantity')}
              preset="count"
              type="number"
              min={1}
              value={lineQty}
              onChange={(e) => setLineQty(e.target.value)}
            />
            <FieldSelect
              label={t('ratePlan')}
              preset="select"
              value={lineRatePlanId}
              onChange={(e) => setLineRatePlanId(e.target.value)}
            >
              <option value="">—</option>
              {ratePlans.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.code}
                </option>
              ))}
            </FieldSelect>
          </FieldRow>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled>
            {t('moreLinesLater')}
          </button>
        </div>
      </EraModal>

      <EraModal
        open={Boolean(pickupBlock)}
        title={t('pickupTitle')}
        onClose={() => setPickupBlock(null)}
        maxWidthClass="max-w-lg w-full"
        footer={
          <EraModalFooter
            onCancel={() => setPickupBlock(null)}
            onSubmit={() => void runPickup()}
            busy={busy}
            submitLabel={t('pickupSubmit')}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <p className="text-[13px] text-[#7F8C8D]">
            {pickupBlock?.code}:{' '}
            {pickupLines.map((l) => `${l.roomTypeCode} ${l.remaining}/${l.quantity}`).join(' · ') ||
              '—'}
          </p>
          <Field
            label={t('bookingCode')}
            preset="code"
            value={pickupCode}
            onChange={(e) => setPickupCode(e.target.value)}
            required
          />
          <Field
            label={t('bookingName')}
            preset="shortText"
            value={pickupName}
            onChange={(e) => setPickupName(e.target.value)}
          />
          <FieldSelect
            label={t('bookerGuest')}
            preset="selectWide"
            value={pickupGuestId}
            onChange={(e) => setPickupGuestId(e.target.value)}
            required
          >
            <option value="">{tc('select')}</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            label={t('folioMode')}
            preset="select"
            value={pickupFolioMode}
            onChange={(e) => setPickupFolioMode(e.target.value)}
          >
            <option value="MASTER">MASTER</option>
            <option value="INDIVIDUAL">INDIVIDUAL</option>
            <option value="SPLIT">SPLIT</option>
          </FieldSelect>
        </div>
      </EraModal>
    </div>
  );
}
