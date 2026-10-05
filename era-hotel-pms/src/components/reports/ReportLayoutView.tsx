'use client';

import { DATA_TABLE_SHELL_CLASS } from '@era/satellite-kit/ui';
import {
  cellFormat,
  columnAlign,
  formatLayoutCell,
  type LayoutRowKind,
  type LayoutSection,
  type ReportLayout,
} from '@/lib/reports/layout';

const KIND_CLASS: Record<LayoutRowKind, string> = {
  data: '',
  group: 'bg-[#EBF5FB] font-semibold',
  subtotal: 'bg-[#F8F9FA] font-semibold border-t border-[#D5DADF]',
  total: 'bg-[#EAEDF1] font-bold border-t-2 border-[#BDC3C7]',
};

const ALIGN_CLASS = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function ReportSectionTable({ section, locale }: { section: LayoutSection; locale: string }) {
  return (
    <div className="space-y-1">
      {section.title ? <h3 className="text-sm font-semibold text-[#34495E]">{section.title}</h3> : null}
      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#D5DADF] bg-[#F8F9FA]">
              <tr>
                {section.columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-center text-sm font-bold text-[#34495E]">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-[#7F8C8D]" colSpan={Math.max(section.columns.length, 1)}>
                    —
                  </td>
                </tr>
              ) : (
                section.rows.map((r, index) => {
                  const kind = r.kind ?? 'data';
                  const stripe = kind === 'data' && index % 2 === 1 ? 'bg-[#F8F9FA]' : '';
                  return (
                    <tr key={index} className={`${KIND_CLASS[kind]} ${stripe}`}>
                      {section.columns.map((c, ci) => (
                        <td
                          key={c.key}
                          className={`whitespace-nowrap px-3 py-1.5 text-[#34495E] ${ALIGN_CLASS[columnAlign(c)]}`}
                        >
                          {formatLayoutCell(r.cells[ci] === undefined ? '' : r.cells[ci], cellFormat(r, c), locale)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Screen view of a report layout: the same sections and rows as the PDF and Excel exports. */
export function ReportLayoutView({
  layout,
  locale,
  noDataLabel,
}: {
  layout: ReportLayout;
  locale: string;
  noDataLabel: string;
}) {
  const sections = layout.sections.filter((s) => s.rows.length > 0);
  if (sections.length === 0) return <p className="text-sm text-[#7F8C8D]">{noDataLabel}</p>;
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <ReportSectionTable key={s.id} section={s} locale={locale} />
      ))}
    </div>
  );
}
