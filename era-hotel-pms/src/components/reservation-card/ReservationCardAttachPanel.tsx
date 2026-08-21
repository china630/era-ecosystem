'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import type { AttachmentRow } from './types';

export function ReservationCardAttachPanel({
  attachments,
  busy,
  onUpload,
  onRefresh,
}: {
  attachments: AttachmentRow[];
  busy?: boolean;
  onUpload: (file: File) => void;
  onRefresh?: () => void;
}) {
  const t = useTranslations('reservationCard');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 rounded-lg border border-[#D5DADF] bg-[#F8FAFC] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#34495E]">{t('attach')}</span>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {t('attachAdd')}
        </button>
        <input
          ref={inputRef}
          type="file"
          className={`hidden ${MODAL_INPUT_CLASS}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[#7F8C8D]">
            <th className="p-1">{t('attachFile')}</th>
            <th className="p-1">{t('attachSize')}</th>
          </tr>
        </thead>
        <tbody>
          {attachments.length === 0 ? (
            <tr>
              <td colSpan={2} className="p-2 text-[#7F8C8D]">
                {t('attachEmpty')}
              </td>
            </tr>
          ) : (
            attachments.map((a) => (
              <tr key={a.id} className="border-t border-[#D5DADF]">
                <td className="p-1">{a.fileName}</td>
                <td className="p-1">{a.fileSize ? `${Math.round(a.fileSize / 1024)} KB` : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {onRefresh ? (
        <button type="button" className="text-[12px] text-[#2980B9] hover:underline" onClick={onRefresh}>
          {t('attachRefresh')}
        </button>
      ) : null}
    </div>
  );
}
