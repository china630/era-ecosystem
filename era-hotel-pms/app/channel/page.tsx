'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface SyncError {
  id: string;
  otaReference: string | null;
  errorMessage: string;
  resolvedAt: string | null;
  createdAt: string;
}

interface StopSell {
  id: string;
  date: string;
  note: string | null;
  roomType: { code: string } | null;
}

interface RoomType {
  id: string;
  code: string;
}

export default function ChannelPage() {
  const { can } = useAuth();
  const t = useTranslations('channel');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [stopSells, setStopSells] = useState<StopSell[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [otaRef, setOtaRef] = useState('');
  const [errorText, setErrorText] = useState('');
  const [stopDate, setStopDate] = useState('');
  const [stopRoomTypeId, setStopRoomTypeId] = useState('');
  const [stopSellModalOpen, setStopSellModalOpen] = useState(false);
  const [logErrorModalOpen, setLogErrorModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [eRes, sRes, rtRes] = await Promise.all([
      fetch('/api/channel/errors'),
      fetch('/api/channel/stop-sell'),
      fetch('/api/master/room-types'),
    ]);
    if (eRes.ok) setErrors(await eRes.json());
    if (sRes.ok) setStopSells(await sRes.json());
    if (rtRes.ok) setRoomTypes(await rtRes.json());
  }, []);

  useEffect(() => {
    setErrorText(t('defaultSyncError'));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stopSellFormId = 'stop-sell-form';
  const logErrorFormId = 'log-error-form';

  async function logError(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otaReference: otaRef || undefined, errorMessage: errorText }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('errorLogged') : data.error);
    if (res.ok) {
      setLogErrorModalOpen(false);
      setOtaRef('');
    }
    await load();
  }

  async function resolve(id: string) {
    const res = await fetch(`/api/channel/errors?id=${id}`, { method: 'PATCH' });
    const data = await res.json();
    setMsg(res.ok ? t('resolved') : data.error);
    await load();
  }

  async function addStopSell(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/stop-sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: stopDate,
        roomTypeId: stopRoomTypeId || undefined,
        note: 'CH-01 stop sell',
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('salesClosed') : data.error);
    if (res.ok) {
      setStopSellModalOpen(false);
      setStopDate('');
      setStopRoomTypeId('');
    }
    await load();
  }

  async function removeStopSell(id: string) {
    const res = await fetch(`/api/channel/stop-sell?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    setMsg(res.ok ? t('stopSellRemoved') : data.error);
    await load();
  }

  if (!can(PERMISSIONS.CHANNEL_MANAGE)) {
    return (
      <AppShell maxWidthClass="max-w-3xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionChannel')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-3xl">
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('stopSell')}</h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('stopSellHint')}</p>
          </div>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setStopSellModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('closeSales')}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('date')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {stopSells.map((s) => (
                <tr key={s.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{s.date.slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{s.roomType?.code ?? tc('all')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button type="button" onClick={() => removeStopSell(s.id)} className={GHOST_BUTTON_CLASS}>
                      {tc('remove')}
                    </button>
                  </td>
                </tr>
              ))}
              {stopSells.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={3} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noStopSell')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('syncJournal')}</h2>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setLogErrorModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('logSyncError')}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('otaRef')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('message')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{e.otaReference ?? tc('dash')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{e.errorMessage}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{e.resolvedAt ? t('resolved') : t('open')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {!e.resolvedAt && (
                      <button type="button" onClick={() => resolve(e.id)} className={GHOST_BUTTON_CLASS}>
                        {tc('resolve')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <EraModal
        open={stopSellModalOpen}
        title={t('stopSell')}
        subtitle={t('stopSellHint')}
        onClose={() => setStopSellModalOpen(false)}
        footer={
          <EraModalFooter
            formId={stopSellFormId}
            onCancel={() => setStopSellModalOpen(false)}
            busy={busy}
            submitLabel={t('closeSales')}
          />
        }
      >
        <form id={stopSellFormId} onSubmit={addStopSell} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stop-date">
              {tc('date')}
            </label>
            <input
              id="stop-date"
              type="date"
              required
              className={MODAL_INPUT_CLASS}
              value={stopDate}
              onChange={(e) => setStopDate(e.target.value)}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stop-roomType">
              {t('roomType')}
            </label>
            <select
              id="stop-roomType"
              className={MODAL_INPUT_CLASS}
              value={stopRoomTypeId}
              onChange={(e) => setStopRoomTypeId(e.target.value)}
            >
              <option value="">{t('allRoomTypes')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
          </div>
        </form>
      </EraModal>

      <EraModal
        open={logErrorModalOpen}
        title={t('logSyncError')}
        onClose={() => setLogErrorModalOpen(false)}
        footer={
          <EraModalFooter
            formId={logErrorFormId}
            onCancel={() => setLogErrorModalOpen(false)}
            busy={busy}
            submitLabel={t('logSyncError')}
          />
        }
      >
        <form id={logErrorFormId} onSubmit={logError} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-ref">
              {t('otaReference')}
            </label>
            <input
              id="ota-ref"
              className={MODAL_INPUT_CLASS}
              value={otaRef}
              onChange={(e) => setOtaRef(e.target.value)}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="error-text">
              {t('errorMessage')}
            </label>
            <input
              id="error-text"
              className={MODAL_INPUT_CLASS}
              value={errorText}
              onChange={(e) => setErrorText(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>
    </AppShell>
  );
}
