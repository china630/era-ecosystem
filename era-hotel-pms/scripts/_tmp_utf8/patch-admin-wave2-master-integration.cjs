'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', 'app', 'admin');

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content.replace(/\r\n/g, '\n'), 'utf8');
  const b = fs.readFileSync(filePath);
  if (b[1] === 0) throw new Error('UTF-16 detected: ' + filePath);
  console.log('utf8 ok', path.relative(process.cwd(), filePath));
}

function patchMasterData() {
  const file = path.join(root, 'master-data', 'page.tsx');
  let s = fs.readFileSync(file, 'utf8');

  s = s.replace(
    `import {
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
import { ListFilterInput } from '@/components/master-data/ListFilterInput';`,
    `import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  Field,
  FieldRow,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';`,
  );

  s = s.replace(
    `function RetireFilterSelect({
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
      className={\`\${MODAL_INPUT_CLASS} max-w-[150px] text-[13px]\`}
      value={value}
      onChange={(e) => onChange(e.target.value as RetireFilter)}
    >
      <option value="ALL">{labels.all}</option>
      <option value="ACTIVE">{labels.active}</option>
      <option value="INACTIVE">{labels.inactive}</option>
    </select>
  );
}`,
    `function RetireFilterSelect({
  value,
  onChange,
  labels,
}: {
  value: RetireFilter;
  onChange: (v: RetireFilter) => void;
  labels: { all: string; active: string; inactive: string };
}) {
  return (
    <FieldSelect
      label={labels.all}
      preset="select"
      value={value}
      onChange={(e) => onChange(e.target.value as RetireFilter)}
    >
      <option value="ALL">{labels.all}</option>
      <option value="ACTIVE">{labels.active}</option>
      <option value="INACTIVE">{labels.inactive}</option>
    </FieldSelect>
  );
}`,
  );

  // Prefer a clearer label for retire status — use activeStatus from masterData via a dedicated prop later;
  // keep labels.all as temporary label key used only for FieldSelect label; update call sites to pass statusLabel.
  s = s.replace(
    `function RetireFilterSelect({
  value,
  onChange,
  labels,
}: {
  value: RetireFilter;
  onChange: (v: RetireFilter) => void;
  labels: { all: string; active: string; inactive: string };
}) {
  return (
    <FieldSelect
      label={labels.all}
      preset="select"
      value={value}
      onChange={(e) => onChange(e.target.value as RetireFilter)}
    >
      <option value="ALL">{labels.all}</option>
      <option value="ACTIVE">{labels.active}</option>
      <option value="INACTIVE">{labels.inactive}</option>
    </FieldSelect>
  );
}`,
    `function RetireFilterSelect({
  value,
  onChange,
  labels,
  statusLabel,
}: {
  value: RetireFilter;
  onChange: (v: RetireFilter) => void;
  labels: { all: string; active: string; inactive: string };
  statusLabel: string;
}) {
  return (
    <FieldSelect
      label={statusLabel}
      preset="select"
      value={value}
      onChange={(e) => onChange(e.target.value as RetireFilter)}
    >
      <option value="ALL">{labels.all}</option>
      <option value="ACTIVE">{labels.active}</option>
      <option value="INACTIVE">{labels.inactive}</option>
    </FieldSelect>
  );
}`,
  );

  s = s.replace(/const \[msg, setMsg\] = useState<string \| null>\(null\);\n  /, '');

  // Success/error toast replacements
  s = s.replace(
    /setMsg\(editRoomType \? t\('roomTypeUpdated'\) : t\('roomTypeCreated'\)\);/g,
    `showSuccess(editRoomType ? t('roomTypeUpdated') : t('roomTypeCreated'));`,
  );
  s = s.replace(
    /setMsg\(editRatePlan \? t\('ratePlanUpdated'\) : t\('ratePlanCreated'\)\);/g,
    `showSuccess(editRatePlan ? t('ratePlanUpdated') : t('ratePlanCreated'));`,
  );
  s = s.replace(
    /setMsg\(editRevenueCode \? t\('revenueCodeUpdated'\) : t\('revenueCodeCreated'\)\);/g,
    `showSuccess(editRevenueCode ? t('revenueCodeUpdated') : t('revenueCodeCreated'));`,
  );
  s = s.replace(
    /setMsg\(editBedType \? t\('bedTypeUpdated'\) : t\('bedTypeCreated'\)\);/g,
    `showSuccess(editBedType ? t('bedTypeUpdated') : t('bedTypeCreated'));`,
  );
  s = s.replace(
    /setMsg\(editRoomView \? t\('roomViewUpdated'\) : t\('roomViewCreated'\)\);/g,
    `showSuccess(editRoomView ? t('roomViewUpdated') : t('roomViewCreated'));`,
  );
  s = s.replace(
    /setMsg\(wasEdit \? t\('roomUpdated', \{ room: roomNum \}\) : t\('roomCreated', \{ room: roomNum \}\)\);/g,
    `showSuccess(wasEdit ? t('roomUpdated', { room: roomNum }) : t('roomCreated', { room: roomNum }));`,
  );
  s = s.replace(/setMsg\(tc\('error'\)\);/g, `showApiError({ error: tc('error') });`);

  s = s.replace(
    `  return (
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
      </PageSection>`,
    `  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setEditRevenueCode(null);
              setRevenueCodeModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('revenueCodes')}
          </button>
        }
      />

      <section className={\`\${CARD_CONTAINER_CLASS} mb-6 p-4\`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('revenueCodes')}</h2>
        <EraListFilterBar showActions={false} className="mb-3">
          <Field
            label={tc('search')}
            preset="longText"
            value={rcFilter}
            onChange={(e) => setRcFilter(e.target.value)}
            placeholder={t('filterPlaceholder')}
          />
          <RetireFilterSelect
            value={rcRetireFilter}
            onChange={setRcRetireFilter}
            labels={retireLabels}
            statusLabel={t('activeStatus')}
          />
        </EraListFilterBar>
        {dictTable(filteredRevenueCodes, (row) => {
          setEditRevenueCode(row);
          setRevenueCodeModalOpen(true);
        })}
      </section>`,
  );

  s = s.replace(
    `      <PageSection className="mb-6">
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
      </PageSection>`,
    `      <section className={\`\${CARD_CONTAINER_CLASS} mb-6 p-4\`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('dictionaries')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[13px] font-medium text-[#34495E]">{t('bedTypes')}</h3>
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
            <EraListFilterBar showActions={false} className="mb-2">
              <Field
                label={tc('search')}
                preset="longText"
                value={bedFilter}
                onChange={(e) => setBedFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
              />
              <RetireFilterSelect
                value={bedRetireFilter}
                onChange={setBedRetireFilter}
                labels={retireLabels}
                statusLabel={t('activeStatus')}
              />
            </EraListFilterBar>
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
            <EraListFilterBar showActions={false} className="mb-2">
              <Field
                label={tc('search')}
                preset="longText"
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
              />
              <RetireFilterSelect
                value={viewRetireFilter}
                onChange={setViewRetireFilter}
                labels={retireLabels}
                statusLabel={t('activeStatus')}
              />
            </EraListFilterBar>
            {dictTable(filteredRoomViews, (row) => {
              setEditRoomView(row);
              setRoomViewModalOpen(true);
            })}
          </div>
        </div>
      </section>`,
  );

  s = s.replace(
    `      <PageSection className="mb-6">
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
        </div>`,
    `      <section className={\`\${CARD_CONTAINER_CLASS} mb-6 p-4\`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('roomTypes')}</h2>
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
        <EraListFilterBar showActions={false} className="mb-3">
          <Field
            label={tc('search')}
            preset="longText"
            value={rtFilter}
            onChange={(e) => setRtFilter(e.target.value)}
            placeholder={t('filterPlaceholder')}
          />
          <RetireFilterSelect
            value={rtRetireFilter}
            onChange={setRtRetireFilter}
            labels={retireLabels}
            statusLabel={t('activeStatus')}
          />
        </EraListFilterBar>`,
  );

  s = s.replace(
    `        </div>
      </PageSection>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('rooms')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilterInput value={roomFilter} onChange={setRoomFilter} placeholder={t('filterRoomPlaceholder')} />
            <select
              className={\`\${MODAL_INPUT_CLASS} max-w-[160px] text-[13px]\`}
              value={roomInventoryFilter}
              onChange={(e) => setRoomInventoryFilter(e.target.value as RoomInventoryFilter)}
            >
              <option value="ALL">{t('allRoomInventory')}</option>
              <option value="INVENTORY">{t('inInventory')}</option>
              <option value="DISABLED">{t('disabledRooms')}</option>
              <option value="DELETED">{t('deletedRooms')}</option>
            </select>
            <select
              className={\`\${MODAL_INPUT_CLASS} max-w-[140px] text-[13px]\`}
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
        </div>`,
    `        </div>
      </section>

      <section className={\`\${CARD_CONTAINER_CLASS} mb-6 p-4\`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('rooms')}</h2>
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
        <EraListFilterBar showActions={false} className="mb-3">
          <Field
            label={tc('search')}
            preset="longText"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            placeholder={t('filterRoomPlaceholder')}
          />
          <FieldSelect
            label={t('activeStatus')}
            preset="selectWide"
            value={roomInventoryFilter}
            onChange={(e) => setRoomInventoryFilter(e.target.value as RoomInventoryFilter)}
          >
            <option value="ALL">{t('allRoomInventory')}</option>
            <option value="INVENTORY">{t('inInventory')}</option>
            <option value="DISABLED">{t('disabledRooms')}</option>
            <option value="DELETED">{t('deletedRooms')}</option>
          </FieldSelect>
          <FieldSelect
            label={t('type')}
            preset="select"
            value={roomTypeFilter}
            onChange={(e) => setRoomTypeFilter(e.target.value)}
          >
            <option value="">{t('allRoomTypes')}</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.code}
              </option>
            ))}
          </FieldSelect>
        </EraListFilterBar>`,
  );

  // rate plans section — find remaining PageSection + ListFilterInput
  s = s.replace(/<\/PageSection>/g, '</section>');
  s = s.replace(/<PageSection className="mb-6">/g, `<section className={\`\${CARD_CONTAINER_CLASS} mb-6 p-4\`}>`);
  s = s.replace(/<PageSection>/g, `<section className={\`\${CARD_CONTAINER_CLASS} p-4\`}>`);

  // Rate plans filter row
  s = s.replace(
    /<ListFilterInput value=\{rpFilter\} onChange=\{setRpFilter\} placeholder=\{t\('filterPlaceholder'\)\} \/>\s*<RetireFilterSelect value=\{rpRetireFilter\} onChange=\{setRpRetireFilter\} labels=\{retireLabels\} \/>/,
    `<EraListFilterBar showActions={false} className="mb-0">
              <Field
                label={tc('search')}
                preset="longText"
                value={rpFilter}
                onChange={(e) => setRpFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
              />
              <RetireFilterSelect
                value={rpRetireFilter}
                onChange={setRpRetireFilter}
                labels={retireLabels}
                statusLabel={t('activeStatus')}
              />
            </EraListFilterBar>`,
  );

  // If rate plan section still wraps filter in flex with add button, leave add button outside
  // Close AppShell
  s = s.replace(/\n    <\/AppShell>\n  \);\n}/, '\n    </>\n  );\n}');
  s = s.replace(/<\/AppShell>/g, '</>');

  if (s.includes('ListFilterInput') || s.includes('StatusMessage') || s.includes('AppShell') || s.includes('MODAL_INPUT_CLASS') || s.includes('PageSection')) {
    console.warn('master-data still has leftovers:', {
      ListFilterInput: s.includes('ListFilterInput'),
      StatusMessage: s.includes('StatusMessage'),
      AppShell: s.includes('AppShell'),
      MODAL_INPUT_CLASS: s.includes('MODAL_INPUT_CLASS'),
      PageSection: s.includes('PageSection'),
      setMsg: s.includes('setMsg'),
    });
  }

  writeUtf8(file, s);
}

function patchIntegration() {
  const file = path.join(root, 'integration', 'page.tsx');
  let s = fs.readFileSync(file, 'utf8');

  s = s.replace(
    `import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';`,
    `import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';`,
  );

  // PosBridgeTestModal
  s = s.replace(
    `  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = 'pos-bridge-form';

  async function send() {
    setBusy(true);
    const res = await fetch('/api/pos/room-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNumber,
        revenueCode: 'FOOD',
        amount: parseFloat(amount),
        description: t('posBridgeDescription'),
        outletCode: 'RESTAURANT',
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('roomChargePosted') : data.error);
    if (res.ok) onClose();
  }`,
    `  const [busy, setBusy] = useState(false);
  const formId = 'pos-bridge-form';

  async function send() {
    setBusy(true);
    try {
      const res = await fetch('/api/pos/room-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          revenueCode: 'FOOD',
          amount: parseFloat(amount),
          description: t('posBridgeDescription'),
          outletCode: 'RESTAURANT',
        }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('roomChargePosted'));
      onClose();
    } catch (e) {
      setBusy(false);
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }`,
  );

  s = s.replace(
    `      <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {msg && <p className="text-[13px] text-[#7F8C8D]">{msg}</p>}
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pos-room">
            Room
          </label>
          <input
            id="pos-room"
            className={MODAL_INPUT_CLASS}
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pos-amount">
            {tc('amount')}
          </label>
          <input
            id="pos-amount"
            className={MODAL_INPUT_CLASS}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </form>`,
    `      <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <Field
          label="Room"
          preset="code"
          id="pos-room"
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
        />
        <Field
          label={tc('amount')}
          preset="amount"
          id="pos-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </form>`,
  );

  // E6SimulatorModal
  s = s.replace(
    `  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = 'e6-simulator-form';

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/integration/erp/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceRef,
        fiscalStatus: status,
        fiscalExternalId: status === 'accepted' ? \`EQ-\${Date.now()}\` : undefined,
        rejectionReason: status === 'rejected' ? t('rejectionDemo') : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('e6Applied', { status: data.document?.fiscalStatus }) : data.error ?? tc('failed'));
    if (res.ok) {
      onDone();
      onClose();
    }
  }`,
    `  const [busy, setBusy] = useState(false);
  const formId = 'e6-simulator-form';

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/integration/erp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceRef,
          fiscalStatus: status,
          fiscalExternalId: status === 'accepted' ? \`EQ-\${Date.now()}\` : undefined,
          rejectionReason: status === 'rejected' ? t('rejectionDemo') : undefined,
        }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('e6Applied', { status: data.document?.fiscalStatus }));
      onDone();
      onClose();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('failed') });
    }
  }`,
  );

  s = s.replace(
    `      <form id={formId} onSubmit={send} className={FORM_STACK_CLASS}>
        {msg && <p className="text-[13px] text-[#7F8C8D]">{msg}</p>}
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="e6-invoice">
            {t('invoiceRefPlaceholder')}
          </label>
          <input
            id="e6-invoice"
            placeholder={t('invoiceRefPlaceholder')}
            className={MODAL_INPUT_CLASS}
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
          />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="e6-status">
            {tc('status')}
          </label>
          <select id="e6-status" className={MODAL_INPUT_CLASS} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="sent">{t('fiscalSent')}</option>
            <option value="accepted">{t('fiscalAccepted')}</option>
            <option value="rejected">{t('fiscalRejected')}</option>
          </select>
        </div>
      </form>`,
    `      <form id={formId} onSubmit={send} className={FORM_STACK_CLASS}>
        <Field
          label={t('invoiceRefPlaceholder')}
          preset="code"
          id="e6-invoice"
          placeholder={t('invoiceRefPlaceholder')}
          value={invoiceRef}
          onChange={(e) => setInvoiceRef(e.target.value)}
        />
        <FieldSelect
          label={tc('status')}
          preset="select"
          id="e6-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="sent">{t('fiscalSent')}</option>
          <option value="accepted">{t('fiscalAccepted')}</option>
          <option value="rejected">{t('fiscalRejected')}</option>
        </FieldSelect>
      </form>`,
  );

  // GlMappingRow input -> Field
  s = s.replace(
    `      <td className={DATA_TABLE_TD_CLASS}>
        <input
          className={MODAL_INPUT_CLASS}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </td>`,
    `      <td className={DATA_TABLE_TD_CLASS}>
        <Field
          label={tc('code')}
          preset="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </td>`,
  );

  // Main page msg -> toast
  s = s.replace(`  const [msg, setMsg] = useState<string | null>(null);\n  const [busy, setBusy] = useState(false);`, `  const [busy, setBusy] = useState(false);`);
  s = s.replace(`    setMsg(null);\n    try {`, `    try {`);
  s = s.replace(`      setMsg(t('settingsSaved'));`, `      showSuccess(t('settingsSaved'));`);
  s = s.replace(
    `      setMsg(e instanceof Error ? e.message : tc('error'));`,
    `      showApiError({ error: e instanceof Error ? e.message : tc('error') });`,
  );
  s = s.replace(`    setMsg(t('retryQueue', { count: data.sent ?? 0 }));`, `    showSuccess(t('retryQueue', { count: data.sent ?? 0 }));`);
  s = s.replace(
    `    setMsg(res.ok ? t('e5Sent', { id: data.correlationId }) : data.error);`,
    `    if (res.ok) showSuccess(t('e5Sent', { id: data.correlationId }));
    else showApiError(data, tc('failed'));`,
  );
  s = s.replace(`      setMsg(data.error ?? tc('updateFailed'));`, `      showApiError(data, tc('updateFailed'));`);
  s = s.replace(`    setMsg(t('glMappingSaved'));`, `    showSuccess(t('glMappingSaved'));`);

  s = s.replace(
    `  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  if (!settings) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      </AppShell>
    );
  }`,
    `  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  if (!settings) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>;
  }`,
  );

  s = s.replace(`    <AppShell maxWidthClass="max-w-4xl">`, `    <>`);
  s = s.replace(`      <StatusMessage>{msg}</StatusMessage>\n\n`, '');
  s = s.replace(/<PageSection className="mb-6 rounded/g, `<section className={\`\${CARD_CONTAINER_CLASS} mb-6 rounded`);
  s = s.replace(/<PageSection className="mb-6 space-y-3/g, `<section className={\`\${CARD_CONTAINER_CLASS} mb-6 space-y-3`);
  s = s.replace(/<PageSection className="mb-6">/g, `<section className={\`\${CARD_CONTAINER_CLASS} mb-6 p-4\`}>`);
  s = s.replace(/<PageSection>/g, `<section className={\`\${CARD_CONTAINER_CLASS} p-4\`}>`);
  s = s.replace(/<\/PageSection>/g, '</section>');

  // URL fields
  s = s.replace(
    `        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="url-default">
            {t('defaultUrl')}
          </label>
          <input
            id="url-default"
            className={MODAL_INPUT_CLASS}
            value={settings.urls.default}
            onChange={(e) =>
              setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })
            }
          />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="url-na">
            {t('nightAuditUrl')}
          </label>
          <input
            id="url-na"
            className={MODAL_INPUT_CLASS}
            value={settings.urls.nightAudit}
            onChange={(e) =>
              setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })
            }
          />
        </div>`,
    `        <Field
          label={t('defaultUrl')}
          preset="longText"
          id="url-default"
          value={settings.urls.default}
          onChange={(e) =>
            setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })
          }
        />
        <Field
          label={t('nightAuditUrl')}
          preset="longText"
          id="url-na"
          value={settings.urls.nightAudit}
          onChange={(e) =>
            setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })
          }
        />`,
  );

  // Add filter bar above outbound journal table
  s = s.replace(
    `      <section className={\`\${CARD_CONTAINER_CLASS} p-4\`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('outboundJournal')}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>`,
    `      <section className={\`\${CARD_CONTAINER_CLASS} p-4\`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('outboundJournal')}</h2>
        <EraListFilterBar
          showActions={false}
          className="mb-3"
          actionsExtra={
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
              {tc('refresh') === 'refresh' ? 'Refresh' : tc('refresh')}
            </button>
          }
        >
          <Field label={tc('search')} preset="longText" value="" readOnly placeholder={t('outboundJournal')} />
        </EraListFilterBar>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>`,
  );

  s = s.replace(`    </AppShell>`, `    </>`);
  s = s.replace(/<\/AppShell>/g, '</>');

  // Better: add real log filter state — do a second pass with search state
  if (!s.includes('logSearchDraft')) {
    s = s.replace(
      `  const [e6ModalOpen, setE6ModalOpen] = useState(false);`,
      `  const [e6ModalOpen, setE6ModalOpen] = useState(false);
  const [logSearchDraft, setLogSearchDraft] = useState('');
  const [logSearchApplied, setLogSearchApplied] = useState('');`,
    );
    s = s.replace(
      `        <EraListFilterBar
          showActions={false}
          className="mb-3"
          actionsExtra={
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
              {tc('refresh') === 'refresh' ? 'Refresh' : tc('refresh')}
            </button>
          }
        >
          <Field label={tc('search')} preset="longText" value="" readOnly placeholder={t('outboundJournal')} />
        </EraListFilterBar>`,
      `        <EraListFilterBar
          applyLabel={tc('filterApply')}
          resetLabel={tc('filterReset')}
          className="mb-3"
          onApply={() => setLogSearchApplied(logSearchDraft)}
          onReset={() => {
            setLogSearchDraft('');
            setLogSearchApplied('');
          }}
        >
          <Field
            label={tc('search')}
            preset="longText"
            value={logSearchDraft}
            onChange={(e) => setLogSearchDraft(e.target.value)}
          />
        </EraListFilterBar>`,
    );
    s = s.replace(
      `{logs.map((l) => (`,
      `{logs
              .filter((l) => {
                const q = logSearchApplied.trim().toLowerCase();
                if (!q) return true;
                return (
                  l.eventType.toLowerCase().includes(q) ||
                  l.status.toLowerCase().includes(q) ||
                  (l.lastError ?? '').toLowerCase().includes(q)
                );
              })
              .map((l) => (`,
    );
  }

  if (s.includes('AppShell') || s.includes('StatusMessage') || s.includes('PageSection') || s.includes('MODAL_INPUT_CLASS') || s.includes('FORM_FIELD_GROUP')) {
    console.warn('integration leftovers', {
      AppShell: s.includes('AppShell'),
      StatusMessage: s.includes('StatusMessage'),
      PageSection: s.includes('PageSection'),
      MODAL_INPUT_CLASS: s.includes('MODAL_INPUT_CLASS'),
      FORM_FIELD_GROUP: s.includes('FORM_FIELD_GROUP'),
      setMsg: s.includes('setMsg'),
    });
  }

  writeUtf8(file, s);
}

patchMasterData();
patchIntegration();
console.log('done');
