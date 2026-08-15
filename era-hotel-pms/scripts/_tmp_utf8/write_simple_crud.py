from pathlib import Path

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms")

SIMPLE = r'''\'use client\';

import { useCallback, useEffect, useMemo, useState } from \'react\';
import { useTranslations } from \'next-intl\';
import {
  EraDataGrid,
  EraListFilterBar,
  Field,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  type FieldWidthPreset,
} from \'@era/satellite-kit/ui\';

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

export type SimpleCrudAddField = {
  name: string;
  label: string;
  preset?: FieldWidthPreset;
  required?: boolean;
  multiline?: boolean;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  min?: string | number;
  step?: string | number;
};

type Props<T extends Record<string, unknown>> = {
  title: string;
  apiPath: string;
  columns: Column<T>[];
  canWrite?: boolean;
  /** Legacy custom add handler (no modal). Prefer addFields. */
  onAdd?: () => void | Promise<void>;
  addFields?: SimpleCrudAddField[];
  buildAddBody?: (values: Record<string, string>) => Record<string, unknown>;
  postPath?: string;
  addLabel?: string;
  addModalTitle?: string;
};

function rowMatches(row: Record<string, unknown>, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return Object.values(row).some((v) => {
    if (v == null) return false;
    if (typeof v === \'object\') return JSON.stringify(v).toLowerCase().includes(needle);
    return String(v).toLowerCase().includes(needle);
  });
}

function defaultsFromFields(fields: SimpleCrudAddField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) out[f.name] = f.defaultValue ?? \'\';
  return out;
}

export function SimpleCrudPage<T extends Record<string, unknown>>({
  title,
  apiPath,
  columns,
  canWrite,
  onAdd,
  addFields,
  buildAddBody,
  postPath,
  addLabel = \'+\',
  addModalTitle,
}: Props<T>) {
  const tc = useTranslations(\'common\');
  const [rows, setRows] = useState<T[]>([]);
  const [searchDraft, setSearchDraft] = useState(\'\');
  const [searchApplied, setSearchApplied] = useState(\'\');
  const [modalOpen, setModalOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiPath);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc(\'loadError\'));
        return;
      }
      setRows(Array.isArray(data) ? data : data.items ?? data.inHouse ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc(\'loadError\') });
    }
  }, [apiPath, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => rowMatches(r as Record<string, unknown>, searchApplied)),
    [rows, searchApplied],
  );

  const useModalAdd = Boolean(addFields?.length);

  function openAddModal() {
    setValues(defaultsFromFields(addFields ?? []));
    setModalOpen(true);
  }

  function closeAddModal() {
    if (busy) return;
    setModalOpen(false);
  }

  async function submitAdd() {
    if (!addFields?.length) return;
    for (const f of addFields) {
      if (f.required && !values[f.name]?.trim()) {
        showApiError({ error: tc(\'required\') });
        return;
      }
    }
    setBusy(true);
    try {
      const body = buildAddBody
        ? buildAddBody(values)
        : Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v]));
      const res = await fetch(postPath ?? apiPath.split(\'?\')[0]!, {
        method: \'POST\',
        headers: { \'Content-Type\': \'application/json\' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc(\'failed\'));
        return;
      }
      showSuccess(tc(\'saved\'));
      setModalOpen(false);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc(\'failed\') });
    } finally {
      setBusy(false);
    }
  }

  const canAdd = canWrite && (useModalAdd || onAdd);

  return (
    <>
      <PageHeader
        title={title}
        actions={
          canAdd ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                if (useModalAdd) openAddModal();
                else void onAdd?.();
              }}
            >
              {addLabel}
            </button>
          ) : undefined
        }
      />
      <EraListFilterBar
        applyLabel={tc(\'filterApply\')}
        resetLabel={tc(\'filterReset\')}
        onApply={() => setSearchApplied(searchDraft)}
        onReset={() => {
          setSearchDraft(\'\');
          setSearchApplied(\'\');
        }}
      >
        <Field
          label={tc(\'search\')}
          preset="longText"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === \'Enter\') {
              e.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
      </EraListFilterBar>
      <EraDataGrid<T>
        columns={columns.map((c) => ({
          key: String(c.key),
          header: c.header,
          render: c.render ? (row: T) => c.render!(row) : undefined,
        }))}
        rows={filtered}
        rowKey={(r) => String(r.id ?? JSON.stringify(r))}
        emptyMessage={tc(\'empty\')}
      />

      {useModalAdd ? (
        <ModalShell
          open={modalOpen}
          title={addModalTitle ?? title}
          onClose={closeAddModal}
          closeLabel={tc(\'close\')}
          footer={
            <ModalFooter
              onCancel={closeAddModal}
              onSubmit={() => void submitAdd()}
              busy={busy}
              cancelLabel={tc(\'cancel\')}
              submitLabel={tc(\'save\')}
            />
          }
        >
          <div className="space-y-3">
            {addFields!.map((f) =>
              f.multiline ? (
                <FieldTextarea
                  key={f.name}
                  label={f.label}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? \'\'}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                />
              ) : (
                <Field
                  key={f.name}
                  label={f.label}
                  preset={f.preset ?? \'longText\'}
                  type={f.type}
                  min={f.min}
                  step={f.step}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? \'\'}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                />
              ),
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
'''

# Fix escaped quotes from the raw string construction above — we used \\' which is wrong.
# Rewrite cleanly without backslash escapes inside r''' using only double quotes where needed.
SIMPLE = SIMPLE.replace("\\'", "'")

path = ROOT / "src/components/wave-b/SimpleCrudPage.tsx"
path.write_text(SIMPLE, encoding="utf-8", newline="\n")
b = path.read_bytes()
print("wrote", path, "len", len(b), "idx1", b[1])
