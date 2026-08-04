'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  Field,
  FieldPanel,
  FieldRow,
  FieldSelect,
  hotelTenderOptions,
  MODAL_FULL_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { bookingSourceKind, isOtaAgency } from '@/lib/booking-source-kind';

type SelectOpt = { id: string; label: string; code?: string; adultCapacity?: number; isOta?: boolean };

type RatePlanOpt = SelectOpt & {
  type?: string;
  medicalFlag?: boolean;
  mealPlanId?: string | null;
  roomTypeId?: string | null;
};

type ContractOpt = {
  id: string;
  label: string;
  code: string;
  agencyId: string | null;
  ratePlanId: string;
};

type StayLine = {
  key: string;
  roomTypeId: string;
  /** How many RoomStay rows of this type (same pax / dates). */
  quantity: string;
  adults: string;
  children11_6: string;
  children5_2: string;
  children1_0: string;
  /** Empty = inherit group envelope dates. */
  checkInDate: string;
  checkOutDate: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function ratePlanFitsRoomType(rp: RatePlanOpt, roomTypeId: string): boolean {
  if (!roomTypeId) return true;
  if (rp.type === 'BASE' || !rp.roomTypeId) return true;
  return rp.roomTypeId === roomTypeId;
}

function newLine(defaultRoomTypeId = ''): StayLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roomTypeId: defaultRoomTypeId,
    quantity: '1',
    adults: '1',
    children11_6: '0',
    children5_2: '0',
    children1_0: '0',
    checkInDate: '',
    checkOutDate: '',
  };
}

export type GroupBookingModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (info: { firstStayId?: string; groupId?: string }) => void;
};

export default function GroupBookingModal({ open, onClose, onCreated }: GroupBookingModalProps) {
  const t = useTranslations('groupBooking');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const tr = useTranslations('reservationCard');
  const locale = useLocale();
  const tenderLocale = locale.startsWith('az') ? 'az' : locale.startsWith('ru') ? 'ru' : 'en';

  const [checkIn, setCheckIn] = useState(todayIso);
  const [checkOut, setCheckOut] = useState(() => addDaysIso(todayIso(), 1));
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [defaultRoomTypeId, setDefaultRoomTypeId] = useState('');
  const [guestId, setGuestId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [mealPlanId, setMealPlanId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [salesContractId, setSalesContractId] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [booker, setBooker] = useState('');
  const [guestRep, setGuestRep] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [folioMode, setFolioMode] = useState<'INDIVIDUAL' | 'MASTER' | 'SPLIT'>('MASTER');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [lines, setLines] = useState<StayLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);

  const [guests, setGuests] = useState<SelectOpt[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanOpt[]>([]);
  const [mealPlans, setMealPlans] = useState<SelectOpt[]>([]);
  const [sources, setSources] = useState<SelectOpt[]>([]);
  const [agencies, setAgencies] = useState<SelectOpt[]>([]);
  const [roomTypes, setRoomTypes] = useState<SelectOpt[]>([]);
  const [salesContracts, setSalesContracts] = useState<ContractOpt[]>([]);
  const [avlByType, setAvlByType] = useState<Record<string, number>>({});

  const selectedSource = sources.find((s) => s.id === sourceId);
  const sourceKind = bookingSourceKind(selectedSource?.code);
  const walkInLocked = sourceKind === 'WALKIN';
  const nights = nightsBetween(checkIn, checkOut);

  const selectedRatePlan = ratePlans.find((rp) => rp.id === ratePlanId);
  const mealLockedByPackage = Boolean(selectedRatePlan?.medicalFlag && selectedRatePlan.mealPlanId);

  const agencyOptions = useMemo(() => {
    if (sourceKind === 'AGENCY') return agencies.filter((a) => !a.isOta);
    if (sourceKind === 'BOOKING') return agencies.filter((a) => a.isOta);
    return agencies;
  }, [agencies, sourceKind]);

  const agencyFieldLabel =
    sourceKind === 'BOOKING' ? tr('otaChannel') : sourceKind === 'WALKIN' ? tr('individual') : tr('agency');

  const contractsForAgency = useMemo(
    () => salesContracts.filter((c) => !agencyId || !c.agencyId || c.agencyId === agencyId),
    [salesContracts, agencyId],
  );

  const filteredRatePlans = useMemo(
    () => ratePlans.filter((rp) => ratePlanFitsRoomType(rp, defaultRoomTypeId)),
    [ratePlans, defaultRoomTypeId],
  );

  const neededByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of lines) {
      const typeId = line.roomTypeId || defaultRoomTypeId;
      if (!typeId) continue;
      const q = Math.max(1, Number(line.quantity) || 1);
      map[typeId] = (map[typeId] ?? 0) + q;
    }
    return map;
  }, [lines, defaultRoomTypeId]);

  const totals = useMemo(() => {
    let rooms = 0;
    let adults = 0;
    let children = 0;
    for (const line of lines) {
      const q = Math.max(1, Number(line.quantity) || 1);
      rooms += q;
      adults += q * Math.max(1, Number(line.adults) || 1);
      children +=
        q *
        (Math.max(0, Number(line.children11_6) || 0) +
          Math.max(0, Number(line.children5_2) || 0) +
          Math.max(0, Number(line.children1_0) || 0));
    }
    return { rooms, adults, children };
  }, [lines]);

  const avlBlocked = useMemo(() => {
    const ids = Object.keys(neededByType);
    if (!ids.length || !checkIn || !checkOut) return true;
    for (const id of ids) {
      const needed = neededByType[id] ?? 0;
      const avl = avlByType[id];
      if (avl === undefined) return true;
      if (avl < 1 || needed > avl) return true;
    }
    return false;
  }, [neededByType, avlByType, checkIn, checkOut]);

  useEffect(() => {
    if (!open) return;
    setCheckIn(todayIso());
    setCheckOut(addDaysIso(todayIso(), 1));
    setCode('');
    setName('');
    setDefaultRoomTypeId('');
    setGuestId('');
    setRatePlanId('');
    setMealPlanId('');
    setSourceId('');
    setAgencyId('');
    setSalesContractId('');
    setContractRef('');
    setBooker('');
    setGuestRep('');
    setPaidBy('');
    setFolioMode('MASTER');
    setPaymentMethod('CARD');
    setLines([newLine()]);
    setAvlByType({});

    void Promise.all([
      fetch('/api/guests').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/master/rate-plans').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/master/meal-plans').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/master/booking-sources').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/agencies').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/master/room-types').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/contracts?status=ACTIVE').then((r) => (r.ok ? r.json() : [])),
    ]).then(([g, rp, mp, src, ag, rt, contracts]) => {
      if (Array.isArray(g)) {
        setGuests(g.map((x: { id: string; fullName: string }) => ({ id: x.id, label: x.fullName })));
      }
      if (Array.isArray(rp)) {
        const mapped: RatePlanOpt[] = rp
          .filter((x: { active?: boolean }) => x.active !== false)
          .map(
            (x: {
              id: string;
              code: string;
              name?: string;
              type?: string;
              medicalFlag?: boolean;
              mealPlanId?: string | null;
              roomTypeId?: string | null;
            }) => ({
              id: x.id,
              code: x.code,
              type: x.type,
              medicalFlag: !!x.medicalFlag,
              mealPlanId: x.mealPlanId ?? null,
              roomTypeId: x.roomTypeId ?? null,
              label: `${x.name ? `${x.code} — ${x.name}` : x.code}${x.medicalFlag ? tc('medicalSuffix') : ''}`,
            }),
          );
        mapped.sort((a, b) => {
          if (!!a.medicalFlag !== !!b.medicalFlag) return a.medicalFlag ? -1 : 1;
          return (a.code ?? a.label).localeCompare(b.code ?? b.label);
        });
        setRatePlans(mapped);
      }
      if (Array.isArray(mp)) {
        setMealPlans(
          mp.map((x: { id: string; code: string; name?: string }) => ({
            id: x.id,
            label: x.name ? `${x.code} — ${x.name}` : x.code,
          })),
        );
      }
      if (Array.isArray(src)) {
        setSources(
          src.map((x: { id: string; code: string; name?: string }) => ({
            id: x.id,
            code: x.code,
            label: x.name ? `${x.code} — ${x.name}` : x.code,
          })),
        );
      }
      if (Array.isArray(ag)) {
        setAgencies(
          ag.map((x: { id: string; code: string; name: string }) => ({
            id: x.id,
            code: x.code,
            label: `${x.code} — ${x.name}`,
            isOta: isOtaAgency(x.code, x.name),
          })),
        );
      }
      if (Array.isArray(rt)) {
        setRoomTypes(
          rt
            .filter((x: { active?: boolean }) => x.active !== false)
            .map((x: { id: string; code: string; name?: string; adultCapacity?: number }) => ({
              id: x.id,
              label: x.name ? `${x.code} — ${x.name}` : x.code,
              adultCapacity: x.adultCapacity,
            })),
        );
      }
      if (Array.isArray(contracts)) {
        setSalesContracts(
          contracts.map(
            (x: {
              id: string;
              code: string;
              name: string;
              agencyId: string | null;
              ratePlanId: string;
            }) => ({
              id: x.id,
              code: x.code,
              agencyId: x.agencyId,
              ratePlanId: x.ratePlanId,
              label: `${x.code} — ${x.name}`,
            }),
          ),
        );
      }
    });
  }, [open, tc]);

  useEffect(() => {
    if (!open || !checkIn || !checkOut) {
      setAvlByType({});
      return;
    }
    const ids = Object.keys(neededByType);
    if (!ids.length) {
      setAvlByType({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      ids.map(async (roomTypeId) => {
        try {
          const res = await fetch(
            `/api/fo/sellable?roomTypeId=${roomTypeId}&from=${checkIn}&to=${checkOut}`,
          );
          const s = await res.json();
          if (s.error) return [roomTypeId, 0] as const;
          return [roomTypeId, Number(s.available ?? 0)] as const;
        } catch {
          return [roomTypeId, 0] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const [id, avl] of pairs) next[id] = avl;
      setAvlByType(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, checkIn, checkOut, neededByType]);

  function setCheckInSafe(iso: string) {
    setCheckIn(iso);
    if (iso && (!checkOut || checkOut <= iso)) {
      setCheckOut(addDaysIso(iso, 1));
    }
  }

  function setCheckOutSafe(iso: string) {
    if (checkIn && iso && iso <= checkIn) {
      setCheckOut(addDaysIso(checkIn, 1));
      return;
    }
    setCheckOut(iso);
  }

  function setDefaultRoomType(next: string) {
    setDefaultRoomTypeId(next);
    setLines((prev) =>
      prev.map((l) => (!l.roomTypeId || l.roomTypeId === defaultRoomTypeId ? { ...l, roomTypeId: next } : l)),
    );
  }

  function applyRatePlan(nextId: string) {
    setRatePlanId(nextId);
    const rp = ratePlans.find((r) => r.id === nextId);
    if (rp?.mealPlanId) setMealPlanId(rp.mealPlanId);
    if (rp?.roomTypeId) setDefaultRoomType(rp.roomTypeId);
  }

  function applySalesContract(nextId: string) {
    setSalesContractId(nextId);
    if (!nextId) {
      setContractRef('');
      return;
    }
    const c = salesContracts.find((x) => x.id === nextId);
    if (!c) return;
    setContractRef(c.code);
    if (c.agencyId) setAgencyId(c.agencyId);
    if (c.ratePlanId) applyRatePlan(c.ratePlanId);
  }

  function updateLine(key: string, patch: Partial<StayLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.checkInDate !== undefined) {
          const ci = patch.checkInDate;
          const co = patch.checkOutDate !== undefined ? patch.checkOutDate : next.checkOutDate;
          if (ci && co && co <= ci) next.checkOutDate = addDaysIso(ci, 1);
        } else if (patch.checkOutDate !== undefined) {
          const baseIn = next.checkInDate || checkIn;
          if (baseIn && patch.checkOutDate && patch.checkOutDate <= baseIn) {
            next.checkOutDate = addDaysIso(baseIn, 1);
          }
        }
        return next;
      }),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function save() {
    if (!guestId || !ratePlanId || !checkIn || !checkOut) {
      showApiError({ error: tc('required') }, tc('failed'));
      return;
    }
    if (!name.trim()) {
      showApiError({ error: t('nameRequired') }, tc('failed'));
      return;
    }
    const resolved = lines.map((l) => ({
      ...l,
      roomTypeId: l.roomTypeId || defaultRoomTypeId,
    }));
    if (!resolved.length || resolved.some((l) => !l.roomTypeId)) {
      showApiError({ error: t('linesRequired') }, tc('failed'));
      return;
    }
    for (const line of resolved) {
      const rt = roomTypes.find((r) => r.id === line.roomTypeId);
      const cap = rt?.adultCapacity ?? 2;
      const adults = Math.max(1, Number(line.adults) || 1);
      if (adults > cap) {
        showApiError(
          {
            error: t('adultsExceedCapacity', {
              type: rt?.label ?? line.roomTypeId,
              adults,
              capacity: cap,
            }),
          },
          tc('failed'),
        );
        return;
      }
      const lineIn = line.checkInDate || checkIn;
      const lineOut = line.checkOutDate || checkOut;
      if (!lineIn || !lineOut || lineOut <= lineIn) {
        showApiError({ error: t('lineDatesInvalid') }, tc('failed'));
        return;
      }
    }
    if (avlBlocked) {
      showApiError({ error: t('insufficientAvl') }, tc('failed'));
      return;
    }

    setBusy(true);
    try {
      const body = {
        code: code.trim() || undefined,
        name: name.trim(),
        guestId,
        ratePlanId,
        mealPlanId: mealPlanId || undefined,
        sourceId: sourceId || undefined,
        agencyId: walkInLocked ? undefined : agencyId || undefined,
        salesContractId: salesContractId || undefined,
        contractRef: contractRef.trim() || undefined,
        booker: booker.trim() || undefined,
        guestRep: guestRep.trim() || undefined,
        paidBy: paidBy.trim() || undefined,
        folioMode,
        paymentMethod,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        lines: resolved.map((l) => ({
          roomTypeId: l.roomTypeId,
          quantity: Math.max(1, Number(l.quantity) || 1),
          adults: Math.max(1, Number(l.adults) || 1),
          children11_6: Math.max(0, Number(l.children11_6) || 0),
          children5_2: Math.max(0, Number(l.children5_2) || 0),
          children1_0: Math.max(0, Number(l.children1_0) || 0),
          ...(l.checkInDate || l.checkOutDate
            ? {
                checkInDate: l.checkInDate || checkIn,
                checkOutDate: l.checkOutDate || checkOut,
              }
            : {}),
        })),
      };
      const res = await fetch('/api/reservation-groups/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('created'));
      const stays = Array.isArray(data.stays) ? data.stays : [];
      const firstStayId = stays[0]?.id as string | undefined;
      const groupId = (data.group?.id ?? data.groupId) as string | undefined;
      onCreated?.({ firstStayId, groupId });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={open}
      title={t('title')}
      subtitle={t('subtitle')}
      onClose={onClose}
      maxWidthClass={`${MODAL_FULL_CLASS} overflow-hidden flex flex-col`}
      bodyClassName="mt-4 min-h-0 flex-1 overflow-hidden flex flex-col"
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void save()}
          busy={busy}
          submitDisabled={busy || avlBlocked}
          submitLabel={tc('save')}
        />
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden text-[13px] lg:grid-cols-[2fr_3fr]">
        <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-[#D5DADF] pr-3">
          <FieldPanel title={tr('stay')}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.75rem] items-end gap-2">
              <DatePicker
                label={tb('checkIn')}
                fluid
                value={checkIn}
                onChange={setCheckInSafe}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
                hint={tr('hintCheckIn')}
              />
              <DatePicker
                label={tb('checkOut')}
                fluid
                value={checkOut}
                onChange={setCheckOutSafe}
                placeholder={tc('datePlaceholder')}
                openCalendarLabel={tc('openCalendar')}
                hint={tr('hintCheckOut')}
              />
              <Field
                label={tr('nights')}
                preset="count"
                value={String(nights)}
                readOnly
                className="min-w-0"
                inputClassName="w-full min-w-0 text-center"
                hint={tr('hintNights')}
              />
            </div>
            <FieldRow cols={2}>
              <Field
                label={t('code')}
                preset="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('codePlaceholder')}
              />
              <Field
                label={t('name')}
                preset="shortText"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FieldRow>
          </FieldPanel>

          <FieldPanel title={tr('productSection')}>
            <FieldRow cols={3} className="min-w-0">
              <FieldSelect
                label={tb('roomType')}
                preset="select"
                className="min-w-0"
                selectClassName="w-full min-w-0 max-w-full"
                value={defaultRoomTypeId}
                onChange={(e) => setDefaultRoomType(e.target.value)}
                hint={t('defaultRoomTypeHint')}
              >
                <option value="">{tc('select')}</option>
                {roomTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.adultCapacity != null ? ` (cap ${r.adultCapacity})` : ''}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect
                label={tr('packageOrRate')}
                preset="select"
                className="min-w-0"
                selectClassName="w-full min-w-0 max-w-full"
                value={ratePlanId}
                onChange={(e) => applyRatePlan(e.target.value)}
                hint={tr('hintPackageOrRate')}
                required
              >
                <option value="">{tc('select')}</option>
                {filteredRatePlans.map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.label}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect
                label={tr('mealPlan')}
                preset="select"
                className="min-w-0"
                selectClassName="w-full min-w-0 max-w-full"
                value={mealPlanId}
                onChange={(e) => setMealPlanId(e.target.value)}
                hint={mealLockedByPackage ? tr('hintMealLocked') : tr('hintMealPlan')}
                disabled={mealLockedByPackage}
              >
                <option value="">—</option>
                {mealPlans.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </FieldSelect>
            </FieldRow>
          </FieldPanel>

          <FieldPanel title={tr('commercialSales')}>
            <FieldRow cols={2}>
              <FieldSelect
                label={tr('source')}
                preset="select"
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setAgencyId('');
                  setSalesContractId('');
                  setContractRef('');
                }}
                hint={tr('hintSource')}
              >
                <option value="">—</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect
                label={agencyFieldLabel}
                preset="selectWide"
                value={walkInLocked ? '' : agencyId}
                onChange={(e) => {
                  setAgencyId(e.target.value);
                  setSalesContractId('');
                  setContractRef('');
                }}
                disabled={walkInLocked}
                hint={tr('hintAgency')}
              >
                <option value="">{walkInLocked ? tr('individual') : tc('select')}</option>
                {!walkInLocked
                  ? agencyOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))
                  : null}
              </FieldSelect>
            </FieldRow>
            <FieldRow cols={2}>
              <FieldSelect
                label={tr('salesContract')}
                preset="selectWide"
                value={salesContractId}
                onChange={(e) => applySalesContract(e.target.value)}
                disabled={!agencyId && contractsForAgency.length === 0}
                hint={tr('hintSalesContract')}
              >
                <option value="">—</option>
                {contractsForAgency.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </FieldSelect>
              <Field
                label={tr('contractRef')}
                preset="code"
                value={contractRef}
                onChange={(e) => setContractRef(e.target.value)}
              />
            </FieldRow>
            <FieldSelect
              label={t('bookerGuest')}
              preset="selectWide"
              value={guestId}
              onChange={(e) => setGuestId(e.target.value)}
              required
              hint={t('bookerGuestHint')}
            >
              <option value="">{tc('select')}</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </FieldSelect>
            <FieldRow cols={3}>
              <Field label={tr('booker')} preset="shortText" value={booker} onChange={(e) => setBooker(e.target.value)} />
              <Field
                label={tr('guestRep')}
                preset="shortText"
                value={guestRep}
                onChange={(e) => setGuestRep(e.target.value)}
              />
              <Field label={tr('paidBy')} preset="shortText" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            </FieldRow>
            <FieldRow cols={2}>
              <CatalogField
                kind="CLOSED_SMALL"
                label={tb('paymentMethod')}
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(String(v))}
                options={hotelTenderOptions(tenderLocale)}
              />
              <FieldSelect
                label={t('folioMode')}
                preset="select"
                value={folioMode}
                onChange={(e) => setFolioMode(e.target.value as 'INDIVIDUAL' | 'MASTER' | 'SPLIT')}
              >
                <option value="MASTER">{t('folioMaster')}</option>
                <option value="INDIVIDUAL">{t('folioIndividual')}</option>
                <option value="SPLIT">{t('folioSplit')}</option>
              </FieldSelect>
            </FieldRow>
          </FieldPanel>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-[#34495E]">{t('stayLines')}</h3>
              <p className={`${TEXT_MUTED_CLASS} mt-0.5 text-[11px]`}>{t('holderContactHint')}</p>
            </div>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setLines((p) => [...p, newLine(defaultRoomTypeId)])}
            >
              {t('addRooms')}
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {lines.map((line) => {
              const effectiveType = line.roomTypeId || defaultRoomTypeId;
              const rt = roomTypes.find((r) => r.id === effectiveType);
              const cap = rt?.adultCapacity;
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-[minmax(6.5rem,1fr)_3.5rem_3.75rem_3rem_3rem_3rem_minmax(6.75rem,0.9fr)_minmax(6.75rem,0.9fr)_2rem] items-end gap-1.5 rounded-md border border-[#D5DADF] bg-[#F8F9FA] p-2"
                >
                  <FieldSelect
                    label={tb('roomType')}
                    preset="select"
                    className="min-w-0"
                    selectClassName="w-full min-w-0 max-w-full"
                    value={line.roomTypeId || defaultRoomTypeId}
                    onChange={(e) => updateLine(line.key, { roomTypeId: e.target.value })}
                    required
                  >
                    <option value="">{tc('select')}</option>
                    {roomTypes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <Field
                    label={t('roomsOfType')}
                    preset="count"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    hint={t('roomsOfTypeHint')}
                    className="min-w-0"
                    inputClassName="w-full min-w-0 text-center"
                  />
                  <Field
                    label={tr('adults')}
                    preset="count"
                    type="number"
                    min={1}
                    max={cap ?? undefined}
                    value={line.adults}
                    onChange={(e) => updateLine(line.key, { adults: e.target.value })}
                    hint={cap != null ? t('capacityHint', { capacity: cap }) : undefined}
                    className="min-w-0"
                    inputClassName="w-full min-w-0 text-center"
                  />
                  <Field
                    label={t('childBand11_6')}
                    preset="count"
                    type="number"
                    min={0}
                    value={line.children11_6}
                    onChange={(e) => updateLine(line.key, { children11_6: e.target.value })}
                    className="min-w-0"
                    inputClassName="w-full min-w-0 text-center"
                    hint={t('childrenGroup')}
                  />
                  <Field
                    label={t('childBand5_2')}
                    preset="count"
                    type="number"
                    min={0}
                    value={line.children5_2}
                    onChange={(e) => updateLine(line.key, { children5_2: e.target.value })}
                    className="min-w-0"
                    inputClassName="w-full min-w-0 text-center"
                  />
                  <Field
                    label={t('childBand1_0')}
                    preset="count"
                    type="number"
                    min={0}
                    value={line.children1_0}
                    onChange={(e) => updateLine(line.key, { children1_0: e.target.value })}
                    className="min-w-0"
                    inputClassName="w-full min-w-0 text-center"
                  />
                  <DatePicker
                    label={t('lineCheckIn')}
                    fluid
                    value={line.checkInDate}
                    onChange={(iso) => updateLine(line.key, { checkInDate: iso })}
                    placeholder={t('lineDatesOptional')}
                    openCalendarLabel={tc('openCalendar')}
                    hint={t('lineDatesOptional')}
                  />
                  <DatePicker
                    label={t('lineCheckOut')}
                    fluid
                    value={line.checkOutDate}
                    onChange={(iso) => updateLine(line.key, { checkOutDate: iso })}
                    placeholder={t('lineDatesOptional')}
                    openCalendarLabel={tc('openCalendar')}
                    hint={t('lineDatesOptional')}
                  />
                  <button
                    type="button"
                    className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D5DADF] bg-white text-[15px] leading-none text-[#7F8C8D] hover:bg-[#F4F5F7] disabled:pointer-events-none disabled:opacity-40"
                    disabled={lines.length <= 1}
                    title={t('removeLine')}
                    aria-label={t('removeLine')}
                    onClick={() => removeLine(line.key)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-2 shrink-0 space-y-2 border-t border-[#D5DADF] bg-white pt-2">
            <div className="rounded-md border border-[#D5DADF] bg-[#F8F9FA] px-3 py-2 text-[12px] text-[#34495E]">
              <span className="font-medium">{t('totalsLabel')}</span>
              <span className={TEXT_MUTED_CLASS}>
                {' '}
                {t('totalsDetail', {
                  rooms: totals.rooms,
                  adults: totals.adults,
                  children: totals.children,
                  nights,
                })}
              </span>
            </div>
            {Object.keys(neededByType).length > 0 ? (
              <div
                className={`rounded-md border px-3 py-2 text-[12px] ${
                  avlBlocked
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : 'border-sky-200 bg-sky-50 text-sky-900'
                }`}
              >
                <div className="font-medium">{t('avlSummary')}</div>
                <ul className={`mt-1 space-y-0.5 ${TEXT_MUTED_CLASS}`}>
                  {Object.entries(neededByType).map(([typeId, needed]) => {
                    const label = roomTypes.find((r) => r.id === typeId)?.label ?? typeId;
                    const avl = avlByType[typeId];
                    return (
                      <li key={typeId}>
                        {t('avlLine', {
                          type: label,
                          needed,
                          available: avl === undefined ? '…' : String(avl),
                        })}
                      </li>
                    );
                  })}
                </ul>
                {avlBlocked ? <div className="mt-1">{t('avlBlockedHint')}</div> : null}
              </div>
            ) : (
              <div
                className={`rounded-md border border-[#D5DADF] bg-[#F8F9FA] px-3 py-2 text-[12px] ${TEXT_MUTED_CLASS}`}
              >
                {t('avlEmptyHint')}
              </div>
            )}
          </div>
        </div>
      </div>
    </EraModal>
  );
}
