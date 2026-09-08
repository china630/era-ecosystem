'use client';

import { useTranslations } from 'next-intl';
import {
  DatePicker,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import type { RatePlanOption, RoomTypeOption } from './types';

export function ChannelFormModals({
  stopSellModalOpen,
  logErrorModalOpen,
  addChannelModalOpen,
  mapRoomModalOpen,
  mapRateModalOpen,
  busy,
  stopDate,
  stopRoomTypeId,
  otaRef,
  errorText,
  channelCode,
  channelName,
  mapRoomTypeId,
  otaRoomCode,
  mapRatePlanId,
  otaRateCode,
  roomTypes,
  ratePlans,
  onStopDate,
  onStopRoomTypeId,
  onOtaRef,
  onErrorText,
  onChannelCode,
  onChannelName,
  onMapRoomTypeId,
  onOtaRoomCode,
  onMapRatePlanId,
  onOtaRateCode,
  onCloseStopSell,
  onCloseLogError,
  onCloseAddChannel,
  onCloseMapRoom,
  onCloseMapRate,
  onAddStopSell,
  onLogError,
  onAddChannel,
  onMapRoomType,
  onMapRatePlan,
}: {
  stopSellModalOpen: boolean;
  logErrorModalOpen: boolean;
  addChannelModalOpen: boolean;
  mapRoomModalOpen: boolean;
  mapRateModalOpen: boolean;
  busy: boolean;
  stopDate: string;
  stopRoomTypeId: string;
  otaRef: string;
  errorText: string;
  channelCode: string;
  channelName: string;
  mapRoomTypeId: string;
  otaRoomCode: string;
  mapRatePlanId: string;
  otaRateCode: string;
  roomTypes: RoomTypeOption[];
  ratePlans: RatePlanOption[];
  onStopDate: (v: string) => void;
  onStopRoomTypeId: (v: string) => void;
  onOtaRef: (v: string) => void;
  onErrorText: (v: string) => void;
  onChannelCode: (v: string) => void;
  onChannelName: (v: string) => void;
  onMapRoomTypeId: (v: string) => void;
  onOtaRoomCode: (v: string) => void;
  onMapRatePlanId: (v: string) => void;
  onOtaRateCode: (v: string) => void;
  onCloseStopSell: () => void;
  onCloseLogError: () => void;
  onCloseAddChannel: () => void;
  onCloseMapRoom: () => void;
  onCloseMapRate: () => void;
  onAddStopSell: (e: React.FormEvent) => void;
  onLogError: (e: React.FormEvent) => void;
  onAddChannel: (e: React.FormEvent) => void;
  onMapRoomType: (e: React.FormEvent) => void;
  onMapRatePlan: (e: React.FormEvent) => void;
}) {
  const t = useTranslations('channel');
  const tc = useTranslations('common');
  const stopSellFormId = 'stop-sell-form';
  const logErrorFormId = 'log-error-form';
  const addChannelFormId = 'add-channel-form';
  const mapRoomFormId = 'map-room-form';
  const mapRateFormId = 'map-rate-form';

  return (
    <>
      <EraModal
        open={stopSellModalOpen}
        title={t('stopSell')}
        subtitle={t('stopSellHint')}
        onClose={onCloseStopSell}
        footer={
          <EraModalFooter
            formId={stopSellFormId}
            onCancel={onCloseStopSell}
            busy={busy}
            submitLabel={t('closeSales')}
          />
        }
      >
        <form id={stopSellFormId} onSubmit={onAddStopSell} className={FORM_STACK_CLASS}>
          <DatePicker
            label={tc('date')}
            value={stopDate}
            onChange={onStopDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
            required
          />
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stop-roomType">
              {t('roomType')}
            </label>
            <select
              id="stop-roomType"
              className={MODAL_INPUT_CLASS}
              value={stopRoomTypeId}
              onChange={(e) => onStopRoomTypeId(e.target.value)}
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
        onClose={onCloseLogError}
        footer={
          <EraModalFooter
            formId={logErrorFormId}
            onCancel={onCloseLogError}
            busy={busy}
            submitLabel={t('logSyncError')}
          />
        }
      >
        <form id={logErrorFormId} onSubmit={onLogError} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-ref">
              {t('otaReference')}
            </label>
            <input
              id="ota-ref"
              className={MODAL_INPUT_CLASS}
              value={otaRef}
              onChange={(e) => onOtaRef(e.target.value)}
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
              onChange={(e) => onErrorText(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={addChannelModalOpen}
        title={t('addChannel')}
        onClose={onCloseAddChannel}
        footer={
          <EraModalFooter
            formId={addChannelFormId}
            onCancel={onCloseAddChannel}
            busy={busy}
            submitLabel={t('addChannel')}
          />
        }
      >
        <form id={addChannelFormId} onSubmit={onAddChannel} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="channel-code">
              {t('channelCode')}
            </label>
            <input
              id="channel-code"
              className={MODAL_INPUT_CLASS}
              value={channelCode}
              onChange={(e) => onChannelCode(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="channel-name">
              {t('channelName')}
            </label>
            <input
              id="channel-name"
              className={MODAL_INPUT_CLASS}
              value={channelName}
              onChange={(e) => onChannelName(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={mapRoomModalOpen}
        title={t('mapRoomType')}
        onClose={onCloseMapRoom}
        footer={
          <EraModalFooter
            formId={mapRoomFormId}
            onCancel={onCloseMapRoom}
            busy={busy}
            submitLabel={t('mapRoomType')}
          />
        }
      >
        <form id={mapRoomFormId} onSubmit={onMapRoomType} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="map-room-type">
              {t('roomType')}
            </label>
            <select
              id="map-room-type"
              className={MODAL_INPUT_CLASS}
              value={mapRoomTypeId}
              onChange={(e) => onMapRoomTypeId(e.target.value)}
              required
            >
              <option value="">{tc('select')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-room-code">
              {t('otaRoomCode')}
            </label>
            <input
              id="ota-room-code"
              className={MODAL_INPUT_CLASS}
              value={otaRoomCode}
              onChange={(e) => onOtaRoomCode(e.target.value)}
              placeholder="ROOM"
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={mapRateModalOpen}
        title={t('mapRatePlan')}
        onClose={onCloseMapRate}
        footer={
          <EraModalFooter
            formId={mapRateFormId}
            onCancel={onCloseMapRate}
            busy={busy}
            submitLabel={t('mapRatePlan')}
          />
        }
      >
        <form id={mapRateFormId} onSubmit={onMapRatePlan} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="map-rate-plan">
              {t('ratePlan')}
            </label>
            <select
              id="map-rate-plan"
              className={MODAL_INPUT_CLASS}
              value={mapRatePlanId}
              onChange={(e) => onMapRatePlanId(e.target.value)}
              required
            >
              <option value="">{tc('select')}</option>
              {ratePlans.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.code}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-rate-code">
              {t('otaRateCode')}
            </label>
            <input
              id="ota-rate-code"
              className={MODAL_INPUT_CLASS}
              value={otaRateCode}
              onChange={(e) => onOtaRateCode(e.target.value)}
              placeholder="RATE"
            />
          </div>
        </form>
      </EraModal>
    </>
  );
}
