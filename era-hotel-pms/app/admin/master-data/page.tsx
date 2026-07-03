'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldRow,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { ListFilterInput } from '@/components/master-data/ListFilterInput';
import { matchesCodeNameQuery, matchesRoomTypeFilter } from '@/lib/list-filter';
import {
  matchesRetireFilter,
  matchesRoomInventoryFilter,
  type RetireFilter,
  type RoomInventoryFilter,
} from '@/lib/master-data/retire-policy';

interface RetireRow {
  active?: boolean;
}

interface RoomType extends RetireRow {
  id: string;
  code: string;
  name: string;
  baseQuota: number;
  adultCapacity?: number;
}

interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomType: { code: string };
  floor?: number;
  viewCode?: string | null;
  bedTypeCode?: string | null;
  location?: string | null;
  maxBed?: number | null;
  disabled?: boolean;
  deleted?: boolean;
}

interface DictRow extends RetireRow {
  id: string;
  code: string;
  name: string;
  systemType?: string | null;
}

interface RatePlan extends RetireRow {
  id: string;
  code: string;
  name: string;
  pricePerNight: string;
  medicalFlag: boolean;
  roomTypeId?: string | null;
}

interface RevenueCode extends RetireRow {
  id: string;
  code: string;
  name: string;
  taxTag?: string | null;
  routingRule?: { targetFolioType: string } | null;
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="text-[#2980B9] hover:underline" onClick={onClick}>
      {label}
    </button>
  );
}

function ActiveStatus({ active }: { active?: boolean }) {
  const t = useTranslations('masterData');
  return (
    <span className={active === false ? 'text-[#C0392B]' : 'text-[#27AE60]'}>
      {active === false ? t('retired') : t('activeLabel')}
    </span>
  );
}

function RetireFilterSelect({
  value,
  onChange,
  labels,
}: {
  value: RetireFilter;
  onChange: (v: RetireFilter) => void;
  labels: { all: string; active: string; inactive: string };
}) {
  return (
    <select
      className={`${MODAL_INPUT_CLASS} max-w-[150px] text-[13px]`}
      value={value}
      onChange={(e) => onChange(e.target.value as RetireFilter)}
    >
      <option value="ALL">{labels.all}</option>
      <option value="ACTIVE">{labels.active}</option>
      <option value="INACTIVE">{labels.inactive}</option>
    </select>
  );
}

export default function MasterDataPage() {
  const t = useTranslations('masterData');
  const tc = useTranslations('common');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<RevenueCode[]>([]);
  const [bedTypes, setBedTypes] = useState<DictRow[]>([]);
  const [roomViews, setRoomViews] = useState<DictRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rcFilter, setRcFilter] = useState('');
  const [bedFilter, setBedFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('');
  const [rtFilter, setRtFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');
  const [rpFilter, setRpFilter] = useState('');
  const [rcRetireFilter, setRcRetireFilter] = useState<RetireFilter>('ALL');
  const [bedRetireFilter, setBedRetireFilter] = useState<RetireFilter>('ALL');
  const [viewRetireFilter, setViewRetireFilter] = useState<RetireFilter>('ALL');
  const [rtRetireFilter, setRtRetireFilter] = useState<RetireFilter>('ALL');
  const [rpRetireFilter, setRpRetireFilter] = useState<RetireFilter>('ALL');
  const [roomInventoryFilter, setRoomInventoryFilter] = useState<RoomInventoryFilter>('ALL');

  const retireLabels = {
    all: t('allRetireStatuses'),
    active: t('activeOnly'),
    inactive: t('inactiveOnly'),
  };

  const [editRoomType, setEditRoomType] = useState<RoomType | null>(null);
  const [roomTypeModalOpen, setRoomTypeModalOpen] = useState(false);
  const [editRatePlan, setEditRatePlan] = useState<RatePlan | null>(null);
  const [ratePlanModalOpen, setRatePlanModalOpen] = useState(false);
  const [editRevenueCode, setEditRevenueCode] = useState<RevenueCode | null>(null);
  const [revenueCodeModalOpen, setRevenueCodeModalOpen] = useState(false);
  const [editBedType, setEditBedType] = useState<DictRow | null>(null);
  const [bedTypeModalOpen, setBedTypeModalOpen] = useState(false);
  const [editRoomView, setEditRoomView] = useState<DictRow | null>(null);
  const [roomViewModalOpen, setRoomViewModalOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  async function load() {
    const [rt, rm, rp, rc, bt, rv] = await Promise.all([
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/rooms?scope=master').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/master/revenue-codes').then((r) => r.json()),
      fetch('/api/master/bed-types').then((r) => r.json()),
      fetch('/api/master/room-views').then((r) => r.json()),
    ]);
    setRoomTypes(rt);
    setRooms(rm);
    setRatePlans(rp);
    setRevenueCodes(rc);
    setBedTypes(bt);
    setRoomViews(rv);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRevenueCodes = useMemo(
    () =>
      revenueCodes.filter(
        (r) => matchesCodeNameQuery(r, rcFilter) && matchesRetireFilter(r, rcRetireFilter),
      ),
    [revenueCodes, rcFilter, rcRetireFilter],
  );
  const filteredBedTypes = useMemo(
    () =>
      bedTypes.filter(
        (r) => matchesCodeNameQuery(r, bedFilter) && matchesRetireFilter(r, bedRetireFilter),
      ),
    [bedTypes, bedFilter, bedRetireFilter],
  );
  const filteredRoomViews = useMemo(
    () =>
      roomViews.filter(
        (r) => matchesCodeNameQuery(r, viewFilter) && matchesRetireFilter(r, viewRetireFilter),
      ),
    [roomViews, viewFilter, viewRetireFilter],
  );
  const filteredRoomTypes = useMemo(
    () =>
      roomTypes.filter(
        (r) => matchesCodeNameQuery(r, rtFilter) && matchesRetireFilter(r, rtRetireFilter),
      ),
    [roomTypes, rtFilter, rtRetireFilter],
  );
  const filteredRatePlans = useMemo(
    () =>
      ratePlans.filter(
        (r) => matchesCodeNameQuery(r, rpFilter) && matchesRetireFilter(r, rpRetireFilter),
      ),
    [ratePlans, rpFilter, rpRetireFilter],
  );
  const filteredRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          matchesCodeNameQuery(r, roomFilter) &&
          matchesRoomTypeFilter(r, roomTypeFilter) &&
          matchesRoomInventoryFilter(r, roomInventoryFilter),
      ),
    [rooms, roomFilter, roomTypeFilter, roomInventoryFilter],
  );

  const roomTypeFormId = 'room-type-form';
  const ratePlanFormId = 'rate-plan-form';
  const revenueCodeFormId = 'revenue-code-form';
  const bedTypeFormId = 'bed-type-form';
  const roomViewFormId = 'room-view-form';
  const roomFormId = 'room-form';

  function dictTable(
    rows: DictRow[],
    onEdit: (row: DictRow) => void,
    extraCol?: (row: DictRow) => React.ReactNode,
  ) {
    return (
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
              {extraCol && <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('systemType')}</th>}
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('activeStatus')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                {extraCol && <td className={DATA_TABLE_TD_CLASS}>{extraCol(row) ?? '—'}</td>}
                <td className={DATA_TABLE_TD_CLASS}>
                  <ActiveStatus active={row.active} />
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <EditButton label={tc('edit')} onClick={() => onEdit(row)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('revenueCodes')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilterInput value={rcFilter} onChange={setRcFilter} placeholder={t('filterPlaceholder')} />
            <RetireFilterSelect value={rcRetireFilter} onChange={setRcRetireFilter} labels={retireLabels} />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditRevenueCode(null);
                setRevenueCodeModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {tc('add')}
            </button>
          </div>
        </div>
        {dictTable(filteredRevenueCodes, (row) => {
          setEditRevenueCode(row);
          setRevenueCodeModalOpen(true);
        })}
      </PageSection>

      <PageSection className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('dictionaries')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[13px] font-medium text-[#34495E]">{t('bedTypes')}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <ListFilterInput value={bedFilter} onChange={setBedFilter} placeholder={t('filterPlaceholder')} />
                <RetireFilterSelect value={bedRetireFilter} onChange={setBedRetireFilter} labels={retireLabels} />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => {
                    setEditBedType(null);
                    setBedTypeModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {tc('add')}
                </button>
              </div>
            </div>
            {dictTable(
              filteredBedTypes,
              (row) => {
                setEditBedType(row);
                setBedTypeModalOpen(true);
              },
              (row) => row.systemType,
            )}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[13px] font-medium text-[#34495E]">{t('roomViews')}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <ListFilterInput value={viewFilter} onChange={setViewFilter} placeholder={t('filterPlaceholder')} />
                <RetireFilterSelect value={viewRetireFilter} onChange={setViewRetireFilter} labels={retireLabels} />
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => {
                    setEditRoomView(null);
                    setRoomViewModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {tc('add')}
                </button>
              </div>
            </div>
            {dictTable(filteredRoomViews, (row) => {
              setEditRoomView(row);
              setRoomViewModalOpen(true);
            })}
          </div>
        </div>
      </PageSection>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('roomTypes')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilterInput value={rtFilter} onChange={setRtFilter} placeholder={t('filterPlaceholder')} />
            <RetireFilterSelect value={rtRetireFilter} onChange={setRtRetireFilter} labels={retireLabels} />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditRoomType(null);
                setRoomTypeModalOpen(true);
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('quota')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('adultCapacity')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('activeStatus')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoomTypes.map((rt) => (
                <tr key={rt.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{rt.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rt.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rt.baseQuota}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rt.adultCapacity ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <ActiveStatus active={rt.active} />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <EditButton
                      label={tc('edit')}
                      onClick={() => {
                        setEditRoomType(rt);
                        setRoomTypeModalOpen(true);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('rooms')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilterInput value={roomFilter} onChange={setRoomFilter} placeholder={t('filterRoomPlaceholder')} />
            <select
              className={`${MODAL_INPUT_CLASS} max-w-[160px] text-[13px]`}
              value={roomInventoryFilter}
              onChange={(e) => setRoomInventoryFilter(e.target.value as RoomInventoryFilter)}
            >
              <option value="ALL">{t('allRoomInventory')}</option>
              <option value="INVENTORY">{t('inInventory')}</option>
              <option value="DISABLED">{t('disabledRooms')}</option>
              <option value="DELETED">{t('deletedRooms')}</option>
            </select>
            <select
              className={`${MODAL_INPUT_CLASS} max-w-[140px] text-[13px]`}
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
            >
              <option value="">{t('allRoomTypes')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditRoom(null);
                setRoomModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('addRoom')}
            </button>
          </div>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('room')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('type')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('floor')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('viewCode')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('bedTypeCode')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('location')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('inventoryStatus')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr key={room.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{room.roomNumber}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{room.roomType?.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{room.floor ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{room.viewCode ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{room.bedTypeCode ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{room.location ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {room.deleted ? t('deletedRooms') : room.disabled ? t('disabledRooms') : t('inInventory')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <EditButton
                      label={tc('edit')}
                      onClick={() => {
                        setEditRoom(room);
                        setRoomModalOpen(true);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('ratePlans')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilterInput value={rpFilter} onChange={setRpFilter} placeholder={t('filterPlaceholder')} />
            <RetireFilterSelect value={rpRetireFilter} onChange={setRpRetireFilter} labels={retireLabels} />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditRatePlan(null);
                setRatePlanModalOpen(true);
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('pricePerNight')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('type')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('medical')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('activeStatus')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRatePlans.map((rp) => (
                <tr key={rp.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{rp.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rp.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{rp.pricePerNight}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {roomTypes.find((rt) => rt.id === rp.roomTypeId)?.code ?? t('anyType')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{rp.medicalFlag ? t('medicalFlag') : '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <ActiveStatus active={rp.active} />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <EditButton
                      label={tc('edit')}
                      onClick={() => {
                        setEditRatePlan(rp);
                        setRatePlanModalOpen(true);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <EraModal
        open={roomTypeModalOpen}
        title={editRoomType ? t('editRoomType') : t('roomTypes')}
        onClose={() => setRoomTypeModalOpen(false)}
        footer={
          <EraModalFooter
            formId={roomTypeFormId}
            onCancel={() => setRoomTypeModalOpen(false)}
            busy={busy}
            submitLabel={editRoomType ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editRoomType?.id ?? 'new-rt'}
          id={roomTypeFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const body = editRoomType
              ? {
                  name: fd.get('name'),
                  baseQuota: Number(fd.get('quota')),
                  adultCapacity: Number(fd.get('adultCapacity') || 2),
                  active: fd.get('active') === 'on',
                }
              : {
                  code: fd.get('code'),
                  name: fd.get('name'),
                  baseQuota: Number(fd.get('quota')),
                  adultCapacity: Number(fd.get('adultCapacity') || 2),
                };
            const res = await fetch(
              editRoomType ? `/api/master/room-types/${editRoomType.id}` : '/api/master/room-types',
              {
                method: editRoomType ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            setBusy(false);
            if (res.ok) {
              setRoomTypeModalOpen(false);
              setEditRoomType(null);
              setMsg(editRoomType ? t('roomTypeUpdated') : t('roomTypeCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          {!editRoomType ? (
            <Field
              label={tc('code')}
              preset="code"
              id="rt-code"
              name="code"
              defaultValue=""
              required
            />
          ) : (
            <Field
              label={tc('code')}
              preset="code"
              id="rt-code"
              name="code"
              defaultValue={editRoomType.code}
              readOnly
              required
            />
          )}
          <Field
            label={tc('name')}
            preset="shortText"
            id="rt-name"
            name="name"
            defaultValue={editRoomType?.name ?? ''}
            required
          />
          <FieldRow cols={2}>
            <Field
              label={tc('quota')}
              preset="count"
              id="rt-quota"
              name="quota"
              type="number"
              defaultValue={editRoomType?.baseQuota ?? ''}
              required
            />
            <Field
              label={t('adultCapacity')}
              preset="count"
              id="rt-adult"
              name="adultCapacity"
              type="number"
              defaultValue={editRoomType?.adultCapacity ?? 2}
            />
          </FieldRow>
          {editRoomType && (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={editRoomType.active !== false}
              />
              {t('activeStatus')}
            </label>
          )}
        </form>
      </EraModal>

      <EraModal
        open={ratePlanModalOpen}
        title={editRatePlan ? t('editRatePlan') : t('ratePlans')}
        onClose={() => setRatePlanModalOpen(false)}
        footer={
          <EraModalFooter
            formId={ratePlanFormId}
            onCancel={() => setRatePlanModalOpen(false)}
            busy={busy}
            submitLabel={editRatePlan ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editRatePlan?.id ?? 'new-rp'}
          id={ratePlanFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const roomTypeId = (fd.get('roomTypeId') as string) || null;
            const body = editRatePlan
              ? {
                  name: fd.get('name'),
                  pricePerNight: Number(fd.get('price')),
                  medicalFlag: fd.get('medical') === 'on',
                  roomTypeId,
                  active: fd.get('active') === 'on',
                }
              : {
                  code: fd.get('code'),
                  name: fd.get('name'),
                  pricePerNight: Number(fd.get('price')),
                  medicalFlag: fd.get('medical') === 'on',
                  roomTypeId: roomTypeId || undefined,
                };
            const res = await fetch(
              editRatePlan ? `/api/master/rate-plans/${editRatePlan.id}` : '/api/master/rate-plans',
              {
                method: editRatePlan ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            setBusy(false);
            if (res.ok) {
              setRatePlanModalOpen(false);
              setEditRatePlan(null);
              setMsg(editRatePlan ? t('ratePlanUpdated') : t('ratePlanCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          {!editRatePlan ? (
            <Field label={tc('code')} preset="code" id="rp-code" name="code" defaultValue="" required />
          ) : (
            <Field
              label={tc('code')}
              preset="code"
              id="rp-code"
              name="code"
              defaultValue={editRatePlan.code}
              readOnly
            />
          )}
          <Field
            label={tc('name')}
            preset="shortText"
            id="rp-name"
            name="name"
            defaultValue={editRatePlan?.name ?? ''}
            required
          />
          <FieldRow cols={2}>
            <Field
              label={t('pricePerNight')}
              preset="amount"
              id="rp-price"
              name="price"
              type="number"
              step="0.01"
              defaultValue={editRatePlan?.pricePerNight ?? ''}
              required
            />
            <FieldSelect
              label={t('type')}
              preset="select"
              id="rp-roomTypeId"
              name="roomTypeId"
              defaultValue={editRatePlan?.roomTypeId ?? ''}
            >
              <option value="">{t('anyType')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </FieldSelect>
          </FieldRow>
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              name="medical"
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              defaultChecked={editRatePlan?.medicalFlag ?? false}
            />
            {t('medical')}
          </label>
          {editRatePlan && (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={editRatePlan.active !== false}
              />
              {t('activeStatus')}
            </label>
          )}
        </form>
      </EraModal>

      <EraModal
        open={revenueCodeModalOpen}
        title={editRevenueCode ? t('editRevenueCode') : t('revenueCodes')}
        onClose={() => setRevenueCodeModalOpen(false)}
        footer={
          <EraModalFooter
            formId={revenueCodeFormId}
            onCancel={() => setRevenueCodeModalOpen(false)}
            busy={busy}
            submitLabel={editRevenueCode ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editRevenueCode?.id ?? 'new-rc'}
          id={revenueCodeFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const folioType = (fd.get('folioType') as string) || null;
            const body = editRevenueCode
              ? {
                  name: fd.get('name'),
                  taxTag: (fd.get('taxTag') as string) || null,
                  targetFolioType: folioType,
                  active: fd.get('active') === 'on',
                }
              : {
                  code: fd.get('code'),
                  name: fd.get('name'),
                  taxTag: (fd.get('taxTag') as string) || undefined,
                  targetFolioType: folioType || undefined,
                };
            const res = await fetch(
              editRevenueCode
                ? `/api/master/revenue-codes/${editRevenueCode.id}`
                : '/api/master/revenue-codes',
              {
                method: editRevenueCode ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            setBusy(false);
            if (res.ok) {
              setRevenueCodeModalOpen(false);
              setEditRevenueCode(null);
              setMsg(editRevenueCode ? t('revenueCodeUpdated') : t('revenueCodeCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          {!editRevenueCode ? (
            <Field label={tc('code')} preset="code" id="rc-code" name="code" defaultValue="" required />
          ) : (
            <Field
              label={tc('code')}
              preset="code"
              id="rc-code"
              name="code"
              defaultValue={editRevenueCode.code}
              readOnly
            />
          )}
          <Field
            label={tc('name')}
            preset="shortText"
            id="rc-name"
            name="name"
            defaultValue={editRevenueCode?.name ?? ''}
            required
          />
          <FieldRow cols={2}>
            <Field
              label={t('taxTag')}
              preset="code"
              id="rc-taxTag"
              name="taxTag"
              placeholder="18%"
              defaultValue={editRevenueCode?.taxTag ?? ''}
            />
            <FieldSelect
              label={t('defaultFolio')}
              preset="select"
              id="rc-folioType"
              name="folioType"
              defaultValue={editRevenueCode?.routingRule?.targetFolioType ?? ''}
            >
              <option value="">{t('defaultFolio')}</option>
              <option value="GUEST">GUEST</option>
              <option value="COMPANY">COMPANY</option>
              <option value="AGENCY">AGENCY</option>
            </FieldSelect>
          </FieldRow>
          {editRevenueCode && (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={editRevenueCode.active !== false}
              />
              {t('activeStatus')}
            </label>
          )}
        </form>
      </EraModal>

      <EraModal
        open={bedTypeModalOpen}
        title={editBedType ? t('editBedType') : t('bedTypes')}
        onClose={() => setBedTypeModalOpen(false)}
        footer={
          <EraModalFooter
            formId={bedTypeFormId}
            onCancel={() => setBedTypeModalOpen(false)}
            busy={busy}
            submitLabel={editBedType ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editBedType?.id ?? 'new-bt'}
          id={bedTypeFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const body = editBedType
              ? {
                  name: fd.get('name'),
                  systemType: (fd.get('systemType') as string) || null,
                  active: fd.get('active') === 'on',
                }
              : {
                  code: fd.get('code'),
                  name: fd.get('name'),
                  systemType: (fd.get('systemType') as string) || undefined,
                };
            const res = await fetch(
              editBedType ? `/api/master/bed-types/${editBedType.id}` : '/api/master/bed-types',
              {
                method: editBedType ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            setBusy(false);
            if (res.ok) {
              setBedTypeModalOpen(false);
              setEditBedType(null);
              setMsg(editBedType ? t('bedTypeUpdated') : t('bedTypeCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          {!editBedType ? (
            <Field label={tc('code')} preset="code" id="bt-code" name="code" defaultValue="" required />
          ) : (
            <Field
              label={tc('code')}
              preset="code"
              id="bt-code"
              name="code"
              defaultValue={editBedType.code}
              readOnly
            />
          )}
          <FieldRow cols={2}>
            <Field
              label={tc('name')}
              preset="shortText"
              id="bt-name"
              name="name"
              defaultValue={editBedType?.name ?? ''}
              required
            />
            <Field
              label={t('systemType')}
              preset="code"
              id="bt-system"
              name="systemType"
              defaultValue={editBedType?.systemType ?? ''}
            />
          </FieldRow>
          {editBedType && (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={editBedType.active !== false}
              />
              {t('activeStatus')}
            </label>
          )}
        </form>
      </EraModal>

      <EraModal
        open={roomViewModalOpen}
        title={editRoomView ? t('editRoomView') : t('roomViews')}
        onClose={() => setRoomViewModalOpen(false)}
        footer={
          <EraModalFooter
            formId={roomViewFormId}
            onCancel={() => setRoomViewModalOpen(false)}
            busy={busy}
            submitLabel={editRoomView ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editRoomView?.id ?? 'new-rv'}
          id={roomViewFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const body = editRoomView
              ? { name: fd.get('name'), active: fd.get('active') === 'on' }
              : { code: fd.get('code'), name: fd.get('name') };
            const res = await fetch(
              editRoomView ? `/api/master/room-views/${editRoomView.id}` : '/api/master/room-views',
              {
                method: editRoomView ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            setBusy(false);
            if (res.ok) {
              setRoomViewModalOpen(false);
              setEditRoomView(null);
              setMsg(editRoomView ? t('roomViewUpdated') : t('roomViewCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          {!editRoomView ? (
            <Field label={tc('code')} preset="code" id="rv-code" name="code" defaultValue="" required />
          ) : (
            <Field
              label={tc('code')}
              preset="code"
              id="rv-code"
              name="code"
              defaultValue={editRoomView.code}
              readOnly
            />
          )}
          <Field
            label={tc('name')}
            preset="shortText"
            id="rv-name"
            name="name"
            defaultValue={editRoomView?.name ?? ''}
            required
          />
          {editRoomView && (
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={editRoomView.active !== false}
              />
              {t('activeStatus')}
            </label>
          )}
        </form>
      </EraModal>

      <EraModal
        open={roomModalOpen}
        title={editRoom ? t('editRoom') : t('addRoom')}
        onClose={() => setRoomModalOpen(false)}
        footer={
          <EraModalFooter
            formId={roomFormId}
            onCancel={() => setRoomModalOpen(false)}
            busy={busy}
            submitLabel={editRoom ? tc('save') : tc('add')}
          />
        }
      >
        <form
          key={editRoom?.id ?? 'new-rm'}
          id={roomFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const body = editRoom
              ? {
                  roomTypeId: fd.get('roomTypeId'),
                  floor: Number(fd.get('floor') || 1),
                  viewCode: (fd.get('viewCode') as string) || null,
                  bedTypeCode: (fd.get('bedTypeCode') as string) || null,
                  location: (fd.get('location') as string) || null,
                  maxBed: fd.get('maxBed') ? Number(fd.get('maxBed')) : null,
                  disabled: fd.get('disabled') === 'on',
                  deleted: fd.get('deleted') === 'on',
                }
              : {
                  roomNumber: fd.get('roomNumber'),
                  roomTypeId: fd.get('roomTypeId'),
                  floor: Number(fd.get('floor') || 1),
                  viewCode: (fd.get('viewCode') as string) || undefined,
                  bedTypeCode: (fd.get('bedTypeCode') as string) || undefined,
                  location: (fd.get('location') as string) || undefined,
                  maxBed: fd.get('maxBed') ? Number(fd.get('maxBed')) : undefined,
                };
            const res = await fetch(editRoom ? `/api/rooms/${editRoom.id}` : '/api/rooms', {
              method: editRoom ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            setBusy(false);
            if (res.ok) {
              setRoomModalOpen(false);
              const roomNum = editRoom?.roomNumber ?? String(fd.get('roomNumber'));
              const wasEdit = !!editRoom;
              setEditRoom(null);
              setMsg(wasEdit ? t('roomUpdated', { room: roomNum }) : t('roomCreated', { room: roomNum }));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          {!editRoom ? (
            <Field
              label={t('room')}
              preset="code"
              id="rm-number"
              name="roomNumber"
              defaultValue=""
              required
            />
          ) : (
            <Field
              label={t('room')}
              preset="code"
              id="rm-number"
              name="roomNumber"
              defaultValue={editRoom.roomNumber}
              readOnly
            />
          )}
          <FieldSelect
            label={t('type')}
            preset="selectWide"
            id="rm-type"
            name="roomTypeId"
            defaultValue={editRoom?.roomTypeId ?? roomTypes[0]?.id}
            required
          >
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.code}
              </option>
            ))}
          </FieldSelect>
          <FieldRow cols={3}>
            <Field
              label={t('floor')}
              preset="count"
              id="rm-floor"
              name="floor"
              type="number"
              defaultValue={editRoom?.floor ?? 1}
            />
            <Field
              label={t('viewCode')}
              preset="code"
              id="rm-view"
              name="viewCode"
              list="room-view-codes"
              defaultValue={editRoom?.viewCode ?? ''}
            />
            <Field
              label={t('bedTypeCode')}
              preset="code"
              id="rm-bed"
              name="bedTypeCode"
              list="bed-type-codes"
              defaultValue={editRoom?.bedTypeCode ?? ''}
            />
          </FieldRow>
          <datalist id="room-view-codes">
            {roomViews.map((v) => (
              <option key={v.id} value={v.code} />
            ))}
          </datalist>
          <datalist id="bed-type-codes">
            {bedTypes.map((b) => (
              <option key={b.id} value={b.code} />
            ))}
          </datalist>
          <FieldRow cols={2}>
            <Field
              label={t('location')}
              preset="shortText"
              id="rm-loc"
              name="location"
              defaultValue={editRoom?.location ?? ''}
            />
            <Field
              label={t('maxBed')}
              preset="count"
              id="rm-max"
              name="maxBed"
              type="number"
              defaultValue={editRoom?.maxBed ?? ''}
            />
          </FieldRow>
          {editRoom && (
            <>
              <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
                <input
                  name="disabled"
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  defaultChecked={editRoom.disabled === true}
                />
                {t('disabledRooms')}
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
                <input
                  name="deleted"
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  defaultChecked={editRoom.deleted === true}
                />
                {t('deletedRooms')}
              </label>
            </>
          )}
        </form>
      </EraModal>
    </AppShell>
  );
}
