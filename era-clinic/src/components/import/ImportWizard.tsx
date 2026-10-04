'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { ImportStepRow } from '@/components/import/ImportStepRow';
import { IMPORT_PHASES } from '@/lib/import/phases';
import {
  clearAllImportStepStatuses,
  clearImportStepStatus,
  loadImportStepStatuses,
  type ImportWizardStorage,
  type StoredImportStepStatus,
} from '@/lib/import/step-status-storage';

type ImportEntity = {
  entity: string;
  label: string;
  order: number;
  templateHint: string;
  columns?: string[];
  fileless?: boolean;
  allowMultiple?: boolean;
};

type Props = {
  entities: ImportEntity[];
};

export function ImportWizard({ entities }: Props) {
  const t = useTranslations('naftaImport');
  const [statuses, setStatuses] = useState<ImportWizardStorage>({});
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    setStatuses(loadImportStepStatuses());
  }, []);

  const entityBySlug = useMemo(
    () => new Map(entities.map((e) => [e.entity, e])),
    [entities],
  );

  const phasesWithEntities = useMemo(
    () =>
      IMPORT_PHASES.map((phase) => ({
        phase,
        entities: phase.entities
          .map((slug) => entityBySlug.get(slug))
          .filter((e): e is ImportEntity => Boolean(e)),
      })).filter((p) => p.entities.length > 0),
    [entityBySlug],
  );

  useEffect(() => {
    if (phaseIndex >= phasesWithEntities.length && phasesWithEntities.length > 0) {
      setPhaseIndex(phasesWithEntities.length - 1);
    }
  }, [phaseIndex, phasesWithEntities.length]);

  const rowLabels = useMemo(
    () => ({
      template: t('templateFile'),
      preview: t('preview'),
      import: t('importConfirm'),
      back: t('back'),
      reimport: t('reimport'),
      rows: t('rows'),
      created: t('created'),
      updated: t('updated'),
      skipped: t('skipped'),
      errors: t('errors'),
      completed: t('stepCompleted'),
      orderWarning: t('orderWarning'),
      pickFileHint: t('pickFileHint'),
      runBootstrap: t('runBootstrap'),
      chunkProgress: t('chunkProgress'),
    }),
    [t],
  );

  const handleStatusChange = useCallback((entity: string, status: StoredImportStepStatus | null) => {
    if (status) {
      setStatuses((prev) => ({ ...prev, [entity]: status }));
      return;
    }
    clearImportStepStatus(entity);
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[entity];
      return next;
    });
  }, []);

  function entityLabel(meta: ImportEntity): string {
    const key = `entities.${meta.entity}` as "entities.procedures";
    return t.has(key) ? t(key) : meta.entity;
  }

  const current = phasesWithEntities[phaseIndex];
  const totalPhases = phasesWithEntities.length;
  let stepCounter = phasesWithEntities
    .slice(0, phaseIndex)
    .reduce((sum, p) => sum + p.entities.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#7F8C8D]">{t('intro')}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/catalog" className={`${SECONDARY_BUTTON_CLASS} text-sm`}>
            {t('verifyMasterData')}
          </Link>
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} text-sm`}
            onClick={() => {
              if (window.confirm(t('resetConfirm'))) {
                clearAllImportStepStatuses();
                setStatuses({});
                setPhaseIndex(0);
                window.location.reload();
              }
            }}
          >
            {t('resetProgress')}
          </button>
        </div>
      </div>

      {totalPhases > 0 ? (
        <p className="text-[13px] font-medium text-[#34495E]">
          {t('phaseProgress', { current: phaseIndex + 1, total: totalPhases })}
        </p>
      ) : null}

      {current ? (
        <section key={current.phase.id}>
          <header className="mb-4">
            <h2 className="text-base font-semibold text-[#34495E]">
              {t(`phase.${current.phase.id}.title`)}
            </h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">
              {t(`phase.${current.phase.id}.hint`)}
            </p>
          </header>
          <div className="space-y-3">
            {current.entities.map((meta, idx) => {
              stepCounter += 1;
              return (
                <ImportStepRow
                  key={meta.entity}
                  stepNumber={stepCounter}
                  entity={meta.entity}
                  label={entityLabel(meta)}
                  templateHint={
                    meta.columns?.length
                      ? t("columnsHint", { columns: meta.columns.join(", ") })
                      : meta.entity
                  }
                  fileless={meta.fileless}
                  allowMultiple={meta.allowMultiple}
                  strictOrder={current.phase.strictOrder}
                  isLastInPhase={idx === current.entities.length - 1}
                  storedStatus={statuses[meta.entity] ?? null}
                  missingPriorLabels={[]}
                  labels={{
                    ...rowLabels,
                    pickFileHint: meta.allowMultiple ? t('pickFileHintMultiple') : rowLabels.pickFileHint,
                  }}
                  onStatusChange={handleStatusChange}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={phaseIndex <= 0}
          onClick={() => setPhaseIndex((i) => Math.max(0, i - 1))}
        >
          {t('prevPhase')}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={phaseIndex >= totalPhases - 1}
          onClick={() => setPhaseIndex((i) => Math.min(totalPhases - 1, i + 1))}
        >
          {t('nextPhase')}
        </button>
      </div>

      <p className="rounded border border-[#D5DADF] bg-[#F8F9FA] p-3 text-[13px] text-[#7F8C8D]">
        {t('coaNote')}
      </p>
    </div>
  );
}
