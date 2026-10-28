'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListFilterBar,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';

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
  const tc = useTranslations('common');
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
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setDays('7')}>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('forecastHorizon')}
          value={days}
          onChange={(v) => setDays(String(v))}
          options={[
            { value: '1', label: t('days1') },
            { value: '7', label: t('days7') },
            { value: '14', label: t('days14') },
            { value: '30', label: t('days30') },
          ]}
        />
      </EraListFilterBar>
      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className="overflow-x-auto">
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                {headers.map((h) => (
                  <th key={h} className={DATA_TABLE_TH_LEFT_CLASS}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {floors.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={headers.length}>
                    {t('forecastEmpty')}
                  </td>
                </tr>
              ) : (
                floors.map((f) => (
                  <tr key={f.floor} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{f.floor}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.departures}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.arrivals}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.stayovers}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.linen}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.deep}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.nsr}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.vip}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{f.headsOnDuty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
