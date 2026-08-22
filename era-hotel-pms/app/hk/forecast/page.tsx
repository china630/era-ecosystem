'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, showApiError } from '@era/satellite-kit/ui';

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

  return (
    <>
      <PageHeader title={t('forecastTitle')} />
      <select className="mb-4 border px-2 py-1" value={days} onChange={(e) => setDays(e.target.value)}>
        <option value="7">7</option>
        <option value="14">14</option>
      </select>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">{t('floor')}</th>
            <th>Dep</th>
            <th>Arr</th>
            <th>Stay</th>
            <th>Linen</th>
            <th>Deep</th>
            <th>NSR</th>
            <th>VIP</th>
            <th>{t('headsOnDuty')}</th>
          </tr>
        </thead>
        <tbody>
          {floors.map((f) => (
            <tr key={f.floor}>
              <td>{f.floor}</td>
              <td>{f.departures}</td>
              <td>{f.arrivals}</td>
              <td>{f.stayovers}</td>
              <td>{f.linen}</td>
              <td>{f.deep}</td>
              <td>{f.nsr}</td>
              <td>{f.vip}</td>
              <td>{f.headsOnDuty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
