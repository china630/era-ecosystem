'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';

type Snapshot = {
  estimate: boolean;
  proxyCporPerPersonNight: number;
  extraAdultBb: number;
  extraAdultFb: number;
  belowFloorCount: number;
  recommended: {
    serviceFee: number;
    breakfast: number;
    lunch: number;
    dinner: number;
    foodCogsDay: number | null;
    medicalCogs: number | null;
  };
  packages: Array<{
    code: string;
    name: string;
    sell1: number;
    floor1: number | null;
    belowFloor: boolean;
    sell2: number | null;
    floor2: number | null;
  }>;
};

export default function UnitEconomicsPage() {
  const t = useTranslations('unitEconomics');
  const tc = useTranslations('common');
  const [data, setData] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/executive/unit-economics');
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('loadError'));
        return;
      }
      setData(json);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        leading={
          <Link className="text-[13px] text-[#2980B9] hover:underline" href="/executive">
            {t('backExecutive')}
          </Link>
        }
      />

      {!data ? (
        <p className="text-sm text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <div className="space-y-4">
          {data.estimate ? (
            <p className="m-0 rounded border border-[#F0E6C8] bg-[#FFF9E8] px-3 py-2 text-[13px] text-[#8A6D1B]">
              {t('estimateBadge')}
            </p>
          ) : null}

          <section className={`${CARD_CONTAINER_CLASS} grid gap-3 p-4 sm:grid-cols-3`}>
            <div>
              <p className="m-0 text-[12px] text-[#7F8C8D]">{t('proxyCpor')}</p>
              <p className="m-0 text-xl font-semibold text-[#2C3E50]">
                {data.proxyCporPerPersonNight.toFixed(2)} AZN
              </p>
            </div>
            <div>
              <p className="m-0 text-[12px] text-[#7F8C8D]">{t('extraAdultBb')}</p>
              <p className="m-0 text-xl font-semibold text-[#2C3E50]">
                {data.extraAdultBb.toFixed(2)} AZN
              </p>
            </div>
            <div>
              <p className="m-0 text-[12px] text-[#7F8C8D]">{t('belowFloor')}</p>
              <p
                className={`m-0 text-xl font-semibold ${
                  data.belowFloorCount > 0 ? 'text-[#C0392B]' : 'text-[#27AE60]'
                }`}
              >
                {data.belowFloorCount}
              </p>
            </div>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 mt-0 text-sm font-semibold text-[#34495E]">{t('components')}</h2>
            <ul className="m-0 list-disc space-y-1 pl-5 text-[13px] text-[#34495E]">
              <li>
                {t('serviceFee')}: {data.recommended.serviceFee.toFixed(2)} AZN
              </li>
              <li>
                {t('meals')}: B/L/D {data.recommended.breakfast}/{data.recommended.lunch}/
                {data.recommended.dinner}
              </li>
              <li>
                {t('foodCogs')}: {data.recommended.foodCogsDay ?? '—'}
              </li>
              <li>
                {t('medicalCogs')}: {data.recommended.medicalCogs ?? '—'}
              </li>
            </ul>
          </section>

          <section className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h2 className="mb-2 mt-0 text-sm font-semibold text-[#34495E]">{t('packages')}</h2>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sell1')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('floor1')}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sell2')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.packages.map((p) => (
                    <tr key={p.code} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{p.code}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{p.name}</td>
                      <td
                        className={`${DATA_TABLE_TD_CLASS} ${
                          p.belowFloor ? 'font-semibold text-[#C0392B]' : ''
                        }`}
                      >
                        {p.sell1.toFixed(2)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {p.floor1 == null ? '—' : p.floor1.toFixed(2)}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {p.sell2 == null ? '—' : p.sell2.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
