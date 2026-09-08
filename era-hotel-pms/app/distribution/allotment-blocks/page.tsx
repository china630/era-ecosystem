'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import {
  CatalogField,
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
type SalesContractOpt = {
  id: string;
  code: string;
  name: string;
  agencyId: string | null;
  validFrom: string;
  validTo: string | null;
  status: string;
};
type BlockLine = {
  id?: string;
  roomTypeId: string;
  quantity: number;
  ratePlanId: string | null;
  roomType?: RoomType;
};
type Block = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  validFrom: string;
  validTo: string;
  cutoffDate: string | null;
  notes: string | null;
  agencyId: string | null;
  salesContractId: string | null;
  agency: Agency | null;
  salesContract?: { id: string; code: string; name: string } | null;
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

type LineDraft = { roomTypeId: string; quantity: string; ratePlanId: string };

function catalogStr(v: string | string[]): string {
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return '';
  const s = typeof v === 'string' ? v : v.toISOString();
  return s.slice(0, 10);
}

function emptyLine(): LineDraft {
  return { roomTypeId: '', quantity: '', ratePlanId: '' };
}

function emptyForm() {
  return {
    code: '',
    name: '',
    status: 'TENTATIVE',
    agencyId: '',
    salesContractId: '',
    validFrom: '',
    validTo: '',
    cutoffDate: '',
    notes: '',
    lines: [emptyLine()] as LineDraft[],
  };
}

export default function AllotmentBlocksPage() {
  const { can } = useAuth();
  const t = useTranslations('allotmentBlocks');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const prefillContractId = searchParams.get('contractId') ?? '';

  const [rows, setRows] = useState<Block[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [contracts, setContracts] = useState<SalesContractOpt[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [guests, setGuests] = useState<GuestOpt[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pickupBlock, setPickupBlock] = useState<Block | null>(null);
  const [pickupLines, setPickupLines] = useState<PickupLine[]>([]);
  const [pickupCode, setPickupCode] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [pickupGuestId, setPickupGuestId] = useState('');
  const [pickupFolioMode, setPickupFolioMode] = useState('MASTER');
  const [busy, setBusy] = useState(false);
  const [filterQ, setFilterQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [prefillApplied, setPrefillApplied] = useState(false);

  const agencyOptions = useMemo(
    () => agencies.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [agencies],
  );
  const contractOptions = useMemo(
    () =>
      contracts
        .filter((c) => c.status === 'ACTIVE' || c.status === 'DRAFT' || c.id === form.salesContractId)
        .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    [contracts, form.salesContractId],
  );
  const roomTypeOptions = useMemo(
    () => roomTypes.map((rt) => ({ value: rt.id, label: `${rt.code} — ${rt.name}` })),
    [roomTypes],
  );
  const ratePlanOptions = useMemo(
    () => ratePlans.map((rp) => ({ value: rp.id, label: `${rp.code} — ${rp.name}` })),
    [ratePlans],
  );
  const guestOptions = useMemo(
    () => guests.map((g) => ({ value: g.id, label: g.fullName })),
    [guests],
  );
  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: tc('all') },
      { value: 'TENTATIVE', label: 'TENTATIVE' },
      { value: 'DEFINITE', label: 'DEFINITE' },
      { value: 'CANCELLED', label: 'CANCELLED' },
      { value: 'RELEASED', label: 'RELEASED' },
    ],
    [tc],
  );
  const statusFormOptions = useMemo(
    () => [
      { value: 'TENTATIVE', label: 'TENTATIVE' },
      { value: 'DEFINITE', label: 'DEFINITE' },
      { value: 'CANCELLED', label: 'CANCELLED' },
      { value: 'RELEASED', label: 'RELEASED' },
    ],
    [],
  );
  const folioOptions = useMemo(
    () => [
      { value: 'MASTER', label: 'MASTER' },
      { value: 'INDIVIDUAL', label: 'INDIVIDUAL' },
      { value: 'SPLIT', label: 'SPLIT' },
    ],
    [],
  );

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
      fetch('/api/admin/travel-agencies').then((r) => r.json()),
      fetch('/api/admin/contracts').then((r) => r.json()),
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
    ]).then(([a, c, rt, rp, g]) => {
      setAgencies(Array.isArray(a) ? a : (a.data ?? []));
      setContracts(Array.isArray(c) ? c : (c.data ?? []));
      setRoomTypes(Array.isArray(rt) ? rt : (rt.data ?? []));
      setRatePlans(Array.isArray(rp) ? rp : (rp.data ?? []));
      const glist = Array.isArray(g) ? g : (g.data ?? []);
      setGuests(
        glist.map((x: { id: string; fullName: string }) => ({ id: x.id, fullName: x.fullName })),
      );
    });
  }, [load]);

  useEffect(() => {
    if (prefillApplied || !prefillContractId || contracts.length === 0) return;
    const contract = contracts.find((c) => c.id === prefillContractId);
    if (!contract) return;
    setForm({
      ...emptyForm(),
      salesContractId: contract.id,
      agencyId: contract.agencyId ?? '',
      validFrom: toDateInput(contract.validFrom),
      validTo: toDateInput(contract.validTo),
      name: contract.name,
      code: `${contract.code}-BLK`,
    });
    setEditingId(null);
    setModalOpen(true);
    setPrefillApplied(true);
  }, [prefillApplied, prefillContractId, contracts]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(b: Block) {
    setEditingId(b.id);
    setForm({
      code: b.code,
      name: b.name ?? '',
      status: b.status,
      agencyId: b.agencyId ?? '',
      salesContractId: b.salesContractId ?? '',
      validFrom: toDateInput(b.validFrom),
      validTo: toDateInput(b.validTo),
      cutoffDate: toDateInput(b.cutoffDate),
      notes: b.notes ?? '',
      lines:
        b.lines.length > 0
          ? b.lines.map((l) => ({
              roomTypeId: l.roomTypeId,
              quantity: String(l.quantity),
              ratePlanId: l.ratePlanId ?? '',
            }))
          : [emptyLine()],
    });
    setModalOpen(true);
  }

  function applyContract(contractId: string) {
    const contract = contracts.find((c) => c.id === contractId);
    setForm((f) => ({
      ...f,
      salesContractId: contractId,
      agencyId: contract?.agencyId ?? f.agencyId,
      validFrom: contract ? toDateInput(contract.validFrom) || f.validFrom : f.validFrom,
      validTo: contract ? toDateInput(contract.validTo) || f.validTo : f.validTo,
    }));
  }

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

  async function saveBlock(e?: React.FormEvent) {
    e?.preventDefault();
    const lines = form.lines
      .filter((l) => l.roomTypeId && Number(l.quantity) >= 1)
      .map((l) => ({
        roomTypeId: l.roomTypeId,
        quantity: Number(l.quantity),
        ratePlanId: l.ratePlanId || null,
      }));
    if (!form.code.trim() || !form.validFrom || !form.validTo || lines.length === 0) {
      showApiError({ error: t('formIncomplete') });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...(editingId ? {} : { code: form.code.trim() }),
        name: form.name.trim() || undefined,
        status: form.status,
        agencyId: form.agencyId || null,
        salesContractId: form.salesContractId || null,
        validFrom: form.validFrom,
        validTo: form.validTo,
        cutoffDate: form.cutoffDate || null,
        notes: form.notes.trim() || null,
        lines,
      };
      const res = await fetch(
        editingId ? `/api/admin/allotment-blocks/${editingId}` : '/api/admin/allotment-blocks',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            editingId
              ? payload
              : {
                  ...payload,
                  code: form.code.trim(),
                  agencyId: form.agencyId || undefined,
                  salesContractId: form.salesContractId || undefined,
                  cutoffDate: form.cutoffDate || undefined,
                  notes: form.notes.trim() || undefined,
                },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(editingId ? t('updated') : t('created'));
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(block: Block, status: string) {
    if (status === 'CANCELLED' && !window.confirm(t('confirmCancel'))) return;
    if (status === 'RELEASED' && !window.confirm(t('confirmRelease'))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/allotment-blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('statusUpdated'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const filtered = rows.filter((b) => {
    if (filterStatus && b.status !== filterStatus) return false;
    if (!filterQ.trim()) return true;
    const q = filterQ.trim().toLowerCase();
    return (
      b.code.toLowerCase().includes(q) ||
      (b.name ?? '').toLowerCase().includes(q) ||
      (b.agency?.code ?? '').toLowerCase().includes(q) ||
      (b.salesContract?.code ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        actions={
          can(PERMISSIONS.MASTER_DATA_MANAGE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="mr-1 inline h-4 w-4" />
              {t('create')}
            </button>
          ) : null
        }
      />
      <p className="text-[13px] text-[#7F8C8D]">{t('productNote')}</p>

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
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('status')}
          value={filterStatus}
          onChange={(v) => setFilterStatus(catalogStr(v))}
          options={statusFilterOptions}
          emptyLabel={null}
        />
      </EraListFilterBar>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('code')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('status')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('agency')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('salesContract')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('dates')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('rooms')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('bookings')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td colSpan={9} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                  {rows.length === 0 ? t('empty') : t('emptyFiltered')}
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{b.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{b.name ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{b.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{b.agency?.code ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{b.salesContract?.code ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {String(b.validFrom).slice(0, 10)} → {String(b.validTo).slice(0, 10)}
                    {b.cutoffDate ? ` · cutoff ${String(b.cutoffDate).slice(0, 10)}` : ''}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {b.lines
                      .map((l) => `${l.roomType?.code ?? '?'}×${l.quantity}`)
                      .join(', ')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{b._count.bookings}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {can(PERMISSIONS.MASTER_DATA_MANAGE) ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => openEdit(b)}
                        >
                          {tc('edit')}
                        </button>
                        {(b.status === 'TENTATIVE' || b.status === 'DEFINITE') && (
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            onClick={() => void openPickup(b)}
                          >
                            {t('pickup')}
                          </button>
                        )}
                        {b.status === 'TENTATIVE' && (
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={busy}
                            onClick={() => void setStatus(b, 'DEFINITE')}
                          >
                            {t('makeDefinite')}
                          </button>
                        )}
                        {(b.status === 'TENTATIVE' || b.status === 'DEFINITE') && (
                          <>
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void setStatus(b, 'RELEASED')}
                            >
                              {t('release')}
                            </button>
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void setStatus(b, 'CANCELLED')}
                            >
                              {t('cancelBlock')}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EraModal
        open={modalOpen}
        title={editingId ? t('edit') : t('create')}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        maxWidthClass="max-w-2xl w-full"
        footer={
          <EraModalFooter
            formId="allotment-block-form"
            onCancel={() => {
              setModalOpen(false);
              setEditingId(null);
            }}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <form id="allotment-block-form" onSubmit={(e) => void saveBlock(e)} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t('code')}
              preset="code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
              disabled={Boolean(editingId)}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('status')}
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: catalogStr(v) }))}
              options={statusFormOptions}
              emptyLabel={null}
            />
          </FieldRow>
          <Field
            label={t('name')}
            preset="shortText"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t('salesContract')}
            value={form.salesContractId}
            onChange={(v) => applyContract(catalogStr(v))}
            options={contractOptions}
            emptyLabel={t('selectContract')}
            hint={t('salesContractHint')}
          />
          <CatalogField
            kind="SEARCHABLE"
            label={t('agency')}
            value={form.agencyId}
            onChange={(v) => setForm((f) => ({ ...f, agencyId: catalogStr(v) }))}
            options={agencyOptions}
            emptyLabel={t('selectAgency')}
          />
          <FieldRow cols={2}>
            <DatePicker
              label={t('validFrom')}
              fluid
              value={form.validFrom}
              onChange={(v) => setForm((f) => ({ ...f, validFrom: v }))}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
            <DatePicker
              label={t('validTo')}
              fluid
              value={form.validTo}
              onChange={(v) => setForm((f) => ({ ...f, validTo: v }))}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
          </FieldRow>
          <DatePicker
            label={t('cutoffDate')}
            fluid
            value={form.cutoffDate}
            onChange={(v) => setForm((f) => ({ ...f, cutoffDate: v }))}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
          <Field
            label={t('notes')}
            preset="longText"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <div className="space-y-3">
            <p className="text-sm font-medium text-[#2C3E50]">{t('lines')}</p>
            <p className="text-xs text-[#7F8C8D]">{t('linesHint')}</p>
            {form.lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded border border-[#ECF0F1] p-3 md:grid-cols-[1fr_100px_1fr_auto]">
                <CatalogField
                  kind="SEARCHABLE"
                  label={t('roomType')}
                  value={line.roomTypeId}
                  onChange={(v) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[idx] = { ...lines[idx], roomTypeId: catalogStr(v) };
                      return { ...f, lines };
                    })
                  }
                  options={roomTypeOptions}
                  emptyLabel={t('selectRoomType')}
                  required
                />
                <Field
                  label={t('quantity')}
                  preset="count"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[idx] = { ...lines[idx], quantity: e.target.value };
                      return { ...f, lines };
                    })
                  }
                  required
                />
                <CatalogField
                  kind="SEARCHABLE"
                  label={t('ratePlan')}
                  value={line.ratePlanId}
                  onChange={(v) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[idx] = { ...lines[idx], ratePlanId: catalogStr(v) };
                      return { ...f, lines };
                    })
                  }
                  options={ratePlanOptions}
                  emptyLabel="—"
                />
                <button
                  type="button"
                  className={`${SECONDARY_BUTTON_CLASS} self-end`}
                  disabled={form.lines.length <= 1}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      lines: f.lines.filter((_, i) => i !== idx),
                    }))
                  }
                  aria-label={tc('delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
            >
              <Plus className="mr-1 inline h-4 w-4" />
              {t('addLine')}
            </button>
          </div>
        </form>
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
          <CatalogField
            kind="SEARCHABLE"
            label={t('bookerGuest')}
            value={pickupGuestId}
            onChange={(v) => setPickupGuestId(catalogStr(v))}
            options={guestOptions}
            emptyLabel={tc('select')}
            required
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('folioMode')}
            value={pickupFolioMode}
            onChange={(v) => setPickupFolioMode(catalogStr(v))}
            options={folioOptions}
            emptyLabel={null}
          />
        </div>
      </EraModal>
    </div>
  );
}
