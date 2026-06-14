'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { ImportStepRow } from '@/components/import/ImportStepRow';
import { IMPORT_PHASES, priorEntities } from '@/lib/import/phases';
import {
  clearAllImportStepStatuses,
  clearImportStepStatus,
  isStepCompleted,
  loadImportStepStatuses,
  type ImportWizardStorage,
  type StoredImportStepStatus,
} from '@/lib/import/step-status-storage';

type ImportEntity = {
  entity: string;
  label: string;
  order: number;
  templateHint: string;
  fileless?: boolean;
};

type Props = {
  entities: ImportEntity[];
};

export function ImportWizard({ entities }: Props) {
  const t = useTranslations('elektrawebImport');
  const [statuses, setStatuses] = useState<ImportWizardStorage>({});

  useEffect(() => {
    setStatuses(loadImportStepStatuses());
  }, []);

  const entityBySlug = useMemo(
    () => new Map(entities.map((e) => [e.entity, e])),
    [entities],
  );

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

  function missingPriorLabels(entity: string): string[] {
    return priorEntities(entity)
      .filter((slug) => !isStepCompleted(slug, statuses))
      .map((slug) => entityBySlug.get(slug)?.label ?? slug);
  }

  let stepCounter = 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#7F8C8D]">{t('intro')}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/master-data" className={`${SECONDARY_BUTTON_CLASS} text-sm`}>
            {t('verifyMasterData')}
          </Link>
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} text-sm`}
            onClick={() => {
              if (window.confirm(t('resetConfirm'))) {
                clearAllImportStepStatuses();
                setStatuses({});
                window.location.reload();
              }
            }}
          >
            {t('resetProgress')}
          </button>
        </div>
      </div>

      {IMPORT_PHASES.map((phase) => {
        const phaseEntities = phase.entities
          .map((slug) => entityBySlug.get(slug))
          .filter((e): e is ImportEntity => Boolean(e));

        if (phaseEntities.length === 0) return null;

        return (
          <section key={phase.id}>
            <header className="mb-4">
              <h2 className="text-base font-semibold text-[#34495E]">{t(`phase.${phase.id}.title`)}</h2>
              <p className="mt-1 text-[13px] text-[#7F8C8D]">{t(`phase.${phase.id}.hint`)}</p>
            </header>
            <div className="space-y-3">
              {phaseEntities.map((meta, idx) => {
                stepCounter += 1;
                return (
                  <ImportStepRow
                    key={meta.entity}
                    stepNumber={stepCounter}
                    entity={meta.entity}
                    label={meta.label}
                    templateHint={meta.templateHint}
                    fileless={meta.fileless}
                    strictOrder={phase.strictOrder}
                    isLastInPhase={idx === phaseEntities.length - 1}
                    storedStatus={statuses[meta.entity] ?? null}
                    missingPriorLabels={missingPriorLabels(meta.entity)}
                    labels={rowLabels}
                    onStatusChange={handleStatusChange}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="rounded border border-[#D5DADF] bg-[#F8F9FA] p-3 text-[13px] text-[#7F8C8D]">
        {t('coaNote')}
      </p>
    </div>
  );
}
