'use client';

import { useTranslations } from 'next-intl';
import { Camera } from 'lucide-react';
import { showSuccess } from '@era/satellite-kit/ui';
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import type { PaxRow, SelectOption } from './types';

export function ReservationCardGuestsTab({
  isCreate,
  guestId,
  guestOptions,
  pax,
  booker,
  guestRep,
  paidBy,
  vipType,
  accomType,
  recordType,
  tripReason,
  onGuestId,
  onPax,
  onField,
  onNewGuest,
  onRepeatGuest,
}: {
  isCreate: boolean;
  guestId: string;
  guestOptions: SelectOption[];
  pax: PaxRow[];
  booker: string;
  guestRep: string;
  paidBy: string;
  vipType: string;
  accomType: string;
  recordType: string;
  tripReason: string;
  onGuestId: (id: string) => void;
  onPax: (rows: PaxRow[]) => void;
  onField: (key: string, value: string) => void;
  onNewGuest: () => void;
  onRepeatGuest?: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const tb = useTranslations('booking');

  return (
    <div className="space-y-4">
      {isCreate ? (
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS}>{tb('guest')}</label>
          <select className={MODAL_INPUT_CLASS} value={guestId} onChange={(e) => onGuestId(e.target.value)} required>
            <option value="">{tc('select')}</option>
            {guestOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          <button type="button" className="mt-2 text-[13px] font-medium text-[#2980B9] hover:underline" onClick={onNewGuest}>
            {tb('newGuest')}
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[12px]">
              <thead className="bg-[#F8FAFC] text-[#7F8C8D]">
                <tr>
                  <th className="p-2">{t('titleCol')}</th>
                  <th className="p-2">{t('gender')}</th>
                  <th className="p-2">{t('name')}</th>
                  <th className="p-2">{t('surname')}</th>
                  <th className="p-2">{t('nationality')}</th>
                  <th className="p-2">{t('age')}</th>
                  <th className="p-2">{t('idCard')}</th>
                  <th className="p-2">{t('passport')}</th>
                  <th className="p-2">{t('memberNo')}</th>
                  <th className="p-2">{t('payStatus')}</th>
                  <th className="p-2">{t('externalResId')}</th>
                  <th className="p-2">{t('guestState')}</th>
                </tr>
              </thead>
              <tbody>
                {pax.map((row, i) => (
                  <tr key={i} className="border-t border-[#D5DADF]">
                    {(
                      [
                        'title',
                        'gender',
                        'firstName',
                        'lastName',
                        'nationality',
                        'age',
                        'idCardNo',
                        'passportNo',
                        'memberNo',
                        'payStatus',
                        'externalResId',
                        'guestState',
                      ] as const
                    ).map(
                      (field) => (
                        <td key={field} className="p-1">
                          <input
                            className={MODAL_INPUT_CLASS}
                            value={row[field]}
                            onChange={(e) => {
                              const next = [...pax];
                              next[i] = { ...row, [field]: e.target.value };
                              onPax(next);
                            }}
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              title={t('cameraStub')}
              onClick={() => showSuccess(t('cameraStub'))}
            >
              <Camera className="mr-1 inline h-4 w-4" />
              {t('camera')}
            </button>
            {onRepeatGuest ? (
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onRepeatGuest}>
                {t('repeatGuest')}
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['booker', booker],
                ['guestRep', guestRep],
                ['paidBy', paidBy],
                ['vipType', vipType],
                ['accomType', accomType],
                ['recordType', recordType],
                ['tripReason', tripReason],
              ] as const
            ).map(([key, val]) => (
              <div key={key} className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t(key)}</label>
                <input className={MODAL_INPUT_CLASS} value={val} onChange={(e) => onField(key, e.target.value)} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
