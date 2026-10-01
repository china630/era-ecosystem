export interface TabularSheet {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function cell(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

function sheetName(key: string): string {
  const cleaned = key.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
  return cleaned || 'Sheet';
}

function objectTable(items: Record<string, unknown>[]): Pick<TabularSheet, 'columns' | 'rows'> {
  const columns: string[] = [];
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (key === 'id') continue;
      const value = item[key];
      if (Array.isArray(value) || (isPlain(value))) continue;
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return {
    columns,
    rows: items.map((item) => columns.map((key) => cell(item[key]))),
  };
}

function uniqueName(name: string, used: Set<string>): string {
  let next = name;
  let n = 2;
  while (used.has(next)) {
    const suffix = `_${n}`;
    next = `${name.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(next);
  return next;
}

/** Turn a report payload into one or more tables (summary scalars + row arrays). */
export function reportToSheets(data: unknown): TabularSheet[] {
  const used = new Set<string>();
  const sheets: TabularSheet[] = [];

  const push = (name: string, columns: string[], rows: (string | number | null)[][]) => {
    sheets.push({ name: uniqueName(sheetName(name), used), columns, rows });
  };

  if (Array.isArray(data)) {
    if (data.length === 0 || !isPlain(data[0])) {
      push('rows', ['value'], data.map((value) => [cell(value)]));
      return sheets;
    }
    const table = objectTable(data.filter(isPlain));
    push('rows', table.columns, table.rows);
    return sheets;
  }

  if (!isPlain(data)) {
    push('Report', ['value'], [[cell(data)]]);
    return sheets;
  }

  const scalars: (string | number | null)[][] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (isPlain(value[0])) {
        const table = objectTable(value.filter(isPlain));
        push(key, table.columns, table.rows);
      } else {
        push(key, ['value'], value.map((item) => [cell(item)]));
      }
      continue;
    }
    if (isPlain(value)) {
      const nestedRows: (string | number | null)[][] = [];
      for (const [nestedKey, nested] of Object.entries(value)) {
        if (Array.isArray(nested) && nested.length > 0 && isPlain(nested[0])) {
          const table = objectTable(nested.filter(isPlain));
          push(`${key}_${nestedKey}`, table.columns, table.rows);
        } else if (!Array.isArray(nested) && !isPlain(nested)) {
          nestedRows.push([nestedKey, cell(nested)]);
        }
      }
      if (nestedRows.length > 0) push(key, ['field', 'value'], nestedRows);
      continue;
    }
    scalars.push([key, cell(value)]);
  }

  if (scalars.length > 0) {
    sheets.unshift({
      name: uniqueName('Summary', used),
      columns: ['field', 'value'],
      rows: scalars,
    });
  }

  if (sheets.length === 0) push('Report', ['field', 'value'], []);
  return sheets;
}
