import { ProductKind } from "@era/bank-core-database";

export type ProductTemplateYamlExport = {
  kind: ProductKind | string;
  name: string;
  currency?: string;
  moduleKey?: string;
  paramsJson?: Record<string, unknown>;
};

const HEADER = "eraBankProductTemplate";

export function stampProductTemplateYamlVersion(
  yaml: string,
  version: string,
): string {
  const text = yaml.replace(/^\uFEFF/, "");
  if (/^\s*version:/m.test(text)) {
    return text.replace(/^\s*version:\s*.+$/m, `  version: ${yamlQuote(version)}`);
  }
  if (text.includes(`${HEADER}:`)) {
    return text.replace(
      `${HEADER}:`,
      `${HEADER}:\n  version: ${yamlQuote(version)}`,
    );
  }
  return `${HEADER}:\n  version: ${yamlQuote(version)}\n${text}`;
}

export function readProductTemplateYamlVersion(yaml: string): string | null {
  return readScalar(yaml.replace(/^\uFEFF/, ""), "version");
}

/** Line-oriented lab diff of two YAML blobs (added/removed/changed). */
export function diffProductTemplateYaml(
  leftYaml: string,
  rightYaml: string,
): {
  leftVersion: string | null;
  rightVersion: string | null;
  added: string[];
  removed: string[];
  changed: Array<{ line: string; from: string; to: string }>;
} {
  const leftLines = normalizeYamlLines(leftYaml);
  const rightLines = normalizeYamlLines(rightYaml);
  const leftMap = new Map(leftLines.map((l) => [l.key, l.value]));
  const rightMap = new Map(rightLines.map((l) => [l.key, l.value]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ line: string; from: string; to: string }> = [];
  for (const [key, value] of rightMap) {
    if (!leftMap.has(key)) added.push(`${key}: ${value}`);
    else if (leftMap.get(key) !== value) {
      changed.push({
        line: key,
        from: leftMap.get(key) ?? "",
        to: value,
      });
    }
  }
  for (const [key, value] of leftMap) {
    if (!rightMap.has(key)) removed.push(`${key}: ${value}`);
  }
  return {
    leftVersion: readProductTemplateYamlVersion(leftYaml),
    rightVersion: readProductTemplateYamlVersion(rightYaml),
    added,
    removed,
    changed,
  };
}

function normalizeYamlLines(
  yaml: string,
): Array<{ key: string; value: string }> {
  return yaml
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx < 0) return { key: line.trim(), value: "" };
      return {
        key: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    });
}

export function exportProductTemplateYaml(
  template: ProductTemplateYamlExport,
): string {
  const lines: string[] = [
    `${HEADER}:`,
    '  version: "1"',
    `  kind: ${template.kind}`,
    `  name: ${yamlQuote(template.name)}`,
  ];
  if (template.currency) {
    lines.push(`  currency: ${template.currency}`);
  }
  if (template.moduleKey) {
    lines.push(`  moduleKey: ${yamlQuote(template.moduleKey)}`);
  }
  if (template.paramsJson && Object.keys(template.paramsJson).length > 0) {
    lines.push("  paramsJson:");
    lines.push(`    ${JSON.stringify(template.paramsJson)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function parseProductTemplateYaml(
  yaml: string,
): ProductTemplateYamlExport {
  const text = yaml.replace(/^\uFEFF/, "").trim();
  if (!text.includes(`${HEADER}:`)) {
    throw new Error("Missing eraBankProductTemplate root");
  }
  const kind = readScalar(text, "kind");
  const name = readScalar(text, "name");
  if (!kind || !name) {
    throw new Error("Product template YAML must include kind and name");
  }
  const currency = readScalar(text, "currency") ?? undefined;
  const moduleKey = readScalar(text, "moduleKey") ?? undefined;
  const paramsLine = text.match(/paramsJson:\s*(\{[\s\S]*?\})/);
  let paramsJson: Record<string, unknown> | undefined;
  if (paramsLine?.[1]) {
    paramsJson = JSON.parse(paramsLine[1]) as Record<string, unknown>;
  }
  return {
    kind: kind as ProductKind,
    name,
    currency,
    moduleKey,
    paramsJson,
  };
}

function yamlQuote(value: string): string {
  if (/^[a-zA-Z0-9_.-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function readScalar(block: string, key: string): string | null {
  const re = new RegExp(`^\\s*${key}:\\s*(.+)$`, "m");
  const match = block.match(re);
  if (!match) return null;
  let raw = match[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return JSON.parse(raw) as string;
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }
  return raw;
}