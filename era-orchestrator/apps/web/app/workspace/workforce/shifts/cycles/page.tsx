"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
import { cycleTape, type Cycle } from "../_lib/types";

export default function WorkforceShiftCyclesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cRes = await wfFetch("shift-cycles");
    if (await isWorkforceGate403(cRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (cRes.ok) setCycles(await cRes.json());
    else setError(t("loadError"));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const cycleSummaries = useMemo(
    () =>
      cycles.map((c) => ({
        ...c,
        tape: cycleTape(c.slots),
      })),
    [cycles],
  );

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("cyclesHeading")} subtitle={t("shiftsHint")} />
      <WorkforceShiftsSubnav />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--era-muted)]">{tCommon("loading")}</p>
      ) : (
        <section className={CARD_CONTAINER_CLASS}>
          <h2 className="mb-3 text-base font-semibold">{t("cyclesHeading")}</h2>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTape")}</th>
                </tr>
              </thead>
              <tbody>
                {cycleSummaries.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.tape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
