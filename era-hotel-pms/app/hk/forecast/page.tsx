'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, PageHeader, showApiError } from '@era/satellite-kit/ui';

type Floor = {
  floor: number;
  departures: number;
  arrivals: number;
  stayovers: number;
  linen: number;
  deep: number;
  nsr: number;
  vip: number;
  headsOnDuty: number;
};

export default function HkForecastPage() {
  const t = useTranslations('housekeeping');
  const [days, setDays] = useState('7');
  const [floors, setFloors] = useState<Floor[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/forecast?days=${days}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    setFloors(json.floors ?? []);
  }, [days, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const headers = [
    t('floor'),
    t('forecastDep'),
    t('forecastArr'),
    t('forecastStay'),
    t('forecastLinen'),
    t('forecastDeep'),
    t('forecastNsr'),
    t('forecastVip'),
    t('headsOnDuty'),
  ];

  return (
    <>
      <PageHeader title={t('forecastTitle')} />
      <div className="mb-4 max-w-xs">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('forecastHorizon')}
          value={days}
          onChange={(v) => setDays(String(v))}
          options={[
            { value: '7', label: t('days7') },
            { value: '14', label: t('days14') },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {floors.map((f) => (
              <tr key={f.floor} className="border-b border-[#ECF0F1]">
                <td className="px-3 py-2 font-medium">{f.floor}</td>
                <td className="px-3 py-2">{f.departures}</td>
                <td className="px-3 py-2">{f.arrivals}</td>
                <td className="px-3 py-2">{f.stayovers}</td>
                <td className="px-3 py-2">{f.linen}</td>
                <td className="px-3 py-2">{f.deep}</td>
                <td className="px-3 py-2">{f.nsr}</td>
                <td className="px-3 py-2">{f.vip}</td>
                <td className="px-3 py-2">{f.headsOnDuty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
