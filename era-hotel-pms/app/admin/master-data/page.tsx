'use client';

import { useEffect, useState } from 'react';
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
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';

interface RoomType {
  id: string;
  code: string;
  name: string;
  baseQuota: number;
}

interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomType: { code: string };
}

interface RatePlan {
  id: string;
  code: string;
  name: string;
  pricePerNight: string;
  medicalFlag: boolean;
}

interface RevenueCode {
  id: string;
  code: string;
  name: string;
}

export default function MasterDataPage() {
  const t = useTranslations('masterData');
  const tc = useTranslations('common');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<RevenueCode[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [roomTypeModalOpen, setRoomTypeModalOpen] = useState(false);
  const [ratePlanModalOpen, setRatePlanModalOpen] = useState(false);
  const [revenueCodeModalOpen, setRevenueCodeModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [rt, rm, rp, rc] = await Promise.all([
      fetch('/api/master/room-types').then((r) => r.json()),
      fetch('/api/rooms').then((r) => r.json()),
      fetch('/api/master/rate-plans').then((r) => r.json()),
      fetch('/api/master/revenue-codes').then((r) => r.json()),
    ]);
    setRoomTypes(rt);
    setRooms(rm);
    setRatePlans(rp);
    setRevenueCodes(rc);
  }

  useEffect(() => {
    load();
  }, []);

  const roomTypeFormId = 'add-room-type-form';
  const ratePlanFormId = 'add-rate-plan-form';
  const revenueCodeFormId = 'add-revenue-code-form';

  return (
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('roomTypes')}</h2>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setRoomTypeModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        </div>
        <ul className="mb-3 space-y-1 text-[13px] text-[#7F8C8D]">
          {roomTypes.map((rt) => (
            <li key={rt.id}>
              {t('roomTypeQuota', { code: rt.code, name: rt.name, quota: rt.baseQuota })}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('rooms')}</h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('room')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('type')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('change')}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{room.roomNumber}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{room.roomType?.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <select
                      className={MODAL_INPUT_CLASS}
                      defaultValue={room.roomTypeId}
                      onChange={async (e) => {
                        const res = await fetch(`/api/rooms/${room.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomTypeId: e.target.value }),
                        });
                        setMsg(res.ok ? t('roomUpdated', { room: room.roomNumber }) : tc('error'));
                        await load();
                      }}
                    >
                      {roomTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.code}
                        </option>
                      ))}
                    </select>
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
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setRatePlanModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        </div>
        <ul className="max-h-32 space-y-1 overflow-auto text-[13px] text-[#7F8C8D]">
          {ratePlans.map((rp) => (
            <li key={rp.id}>
              {t('ratePlanLine', {
                code: rp.code,
                name: rp.name,
                price: rp.pricePerNight,
                medical: rp.medicalFlag ? t('medicalFlag') : '',
              })}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('revenueCodes')}</h2>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setRevenueCodeModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {tc('add')}
          </button>
        </div>
        <ul className="max-h-32 space-y-1 overflow-auto text-[13px] text-[#7F8C8D]">
          {revenueCodes.map((rc) => (
            <li key={rc.id}>
              {t('revenueCodeLine', { code: rc.code, name: rc.name })}
            </li>
          ))}
        </ul>
      </PageSection>

      <EraModal
        open={roomTypeModalOpen}
        title={t('roomTypes')}
        onClose={() => setRoomTypeModalOpen(false)}
        footer={
          <EraModalFooter
            formId={roomTypeFormId}
            onCancel={() => setRoomTypeModalOpen(false)}
            busy={busy}
            submitLabel={tc('add')}
          />
        }
      >
        <form
          id={roomTypeFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/master/room-types', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: fd.get('code'),
                name: fd.get('name'),
                baseQuota: Number(fd.get('quota')),
              }),
            });
            setBusy(false);
            if (res.ok) {
              setRoomTypeModalOpen(false);
              setMsg(t('roomTypeCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rt-code">
              {tc('code')}
            </label>
            <input id="rt-code" name="code" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rt-name">
              {tc('name')}
            </label>
            <input id="rt-name" name="name" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rt-quota">
              {tc('quota')}
            </label>
            <input id="rt-quota" name="quota" type="number" className={MODAL_INPUT_CLASS} required />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={ratePlanModalOpen}
        title={t('ratePlans')}
        onClose={() => setRatePlanModalOpen(false)}
        footer={
          <EraModalFooter
            formId={ratePlanFormId}
            onCancel={() => setRatePlanModalOpen(false)}
            busy={busy}
            submitLabel={tc('add')}
          />
        }
      >
        <form
          id={ratePlanFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/master/rate-plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: fd.get('code'),
                name: fd.get('name'),
                pricePerNight: Number(fd.get('price')),
                medicalFlag: fd.get('medical') === 'on',
                roomTypeId: (fd.get('roomTypeId') as string) || undefined,
              }),
            });
            setBusy(false);
            if (res.ok) {
              setRatePlanModalOpen(false);
              setMsg(t('ratePlanCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rp-code">
              {tc('code')}
            </label>
            <input id="rp-code" name="code" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rp-name">
              {tc('name')}
            </label>
            <input id="rp-name" name="name" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rp-price">
              {t('pricePerNight')}
            </label>
            <input id="rp-price" name="price" type="number" step="0.01" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rp-roomTypeId">
              {t('type')}
            </label>
            <select id="rp-roomTypeId" name="roomTypeId" className={MODAL_INPUT_CLASS}>
              <option value="">{t('anyType')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
            <input name="medical" type="checkbox" className={MODAL_CHECKBOX_CLASS} /> {t('medical')}
          </label>
        </form>
      </EraModal>

      <EraModal
        open={revenueCodeModalOpen}
        title={t('revenueCodes')}
        onClose={() => setRevenueCodeModalOpen(false)}
        footer={
          <EraModalFooter
            formId={revenueCodeFormId}
            onCancel={() => setRevenueCodeModalOpen(false)}
            busy={busy}
            submitLabel={tc('add')}
          />
        }
      >
        <form
          id={revenueCodeFormId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/master/revenue-codes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: fd.get('code'),
                name: fd.get('name'),
                targetFolioType: (fd.get('folioType') as string) || undefined,
              }),
            });
            setBusy(false);
            if (res.ok) {
              setRevenueCodeModalOpen(false);
              setMsg(t('revenueCodeCreated'));
              await load();
            } else {
              setMsg(tc('error'));
            }
          }}
        >
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rc-code">
              {tc('code')}
            </label>
            <input id="rc-code" name="code" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rc-name">
              {tc('name')}
            </label>
            <input id="rc-name" name="name" className={MODAL_INPUT_CLASS} required />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="rc-folioType">
              {t('defaultFolio')}
            </label>
            <select id="rc-folioType" name="folioType" className={MODAL_INPUT_CLASS}>
              <option value="">{t('defaultFolio')}</option>
              <option value="GUEST">GUEST</option>
              <option value="COMPANY">COMPANY</option>
            </select>
          </div>
        </form>
      </EraModal>
    </AppShell>
  );
}
