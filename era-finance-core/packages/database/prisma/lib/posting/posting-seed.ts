import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  OrganizationKind,
  PrismaClient,
  type Prisma,
} from "@prisma/client";
import { assertPostingRole, type PostingRole } from "./posting-role";

export type PostingRolesFile = {
  meta?: { kind?: string; version?: number };
  roles: Record<string, string>;
};

export function postingRolesJsonPath(kind: OrganizationKind): string {
  const slug = kind.toLowerCase();
  return join(
    __dirname,
    "..",
    "..",
    "..",
    "prisma",
    "catalog",
    "national",
    `posting-roles-${slug}.json`,
  );
}

export async function loadPostingRolesJson(
  kind: OrganizationKind,
): Promise<Record<PostingRole, string>> {
  const path = postingRolesJsonPath(kind);
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as PostingRolesFile;
  if (!parsed?.roles || typeof parsed.roles !== "object") {
    throw new Error(`Posting roles JSON invalid: ${path}`);
  }
  const out = {} as Record<PostingRole, string>;
  for (const [role, code] of Object.entries(parsed.roles)) {
    const slug = assertPostingRole(role);
    const trimmed = String(code ?? "").trim();
    if (!trimmed) throw new Error(`Posting role ${role}: empty accountCode in ${path}`);
    out[slug] = trimmed;
  }
  return out;
}

/** Global `template_posting_roles` from catalog JSON. */
export async function upsertGlobalPostingRoleTemplates(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<number> {
  let total = 0;
  for (const kind of [
    OrganizationKind.COMMERCIAL,
    OrganizationKind.BUDGET,
    OrganizationKind.NGO,
  ]) {
    const roles = await loadPostingRolesJson(kind);
    for (const [role, accountCode] of Object.entries(roles)) {
      await db.templatePostingRole.upsert({
        where: { kind_role: { kind, role } },
        create: { kind, role, accountCode },
        update: { accountCode },
      });
      total += 1;
    }
  }
  return total;
}

/**
 * Validates every posting role account code exists in the matching chart-of-accounts JSON.
 */
/**
 * Codes referenced by COMMERCIAL auto-posting but absent from slim chart JSON;
 * created at runtime via {@link NAS_ACCOUNT_FALLBACK} in AccountingService.
 */
export const POSTING_ROLE_RUNTIME_ACCOUNT_CODES: Partial<
  Record<OrganizationKind, readonly string[]>
> = {
  [OrganizationKind.COMMERCIAL]: [
    "241",
    "251",
    "231",
    "713",
    "762",
    "545",
    "244",
    "334",
  ],
  [OrganizationKind.BUDGET]: [],
};

export async function validatePostingRolesAgainstCharts(): Promise<void> {
  const errors: string[] = [];
  for (const kind of [
    OrganizationKind.COMMERCIAL,
    OrganizationKind.BUDGET,
    OrganizationKind.NGO,
  ]) {
    const slug = kind.toLowerCase();
    const chartPath = join(
      __dirname,
      "..",
      "..",
      "..",
      "prisma",
      "catalog",
      "national",
      `chart-of-accounts-${slug}.json`,
    );
    const chartRaw = await readFile(chartPath, "utf-8");
    const chart = JSON.parse(chartRaw) as { accounts: Array<{ code: string }> };
    const codes = new Set(chart.accounts.map((a) => String(a.code).trim()));
    const roles = await loadPostingRolesJson(kind);
    const runtime = new Set(POSTING_ROLE_RUNTIME_ACCOUNT_CODES[kind] ?? []);
    for (const [role, accountCode] of Object.entries(roles)) {
      if (!codes.has(accountCode) && !runtime.has(accountCode)) {
        errors.push(`${kind} role ${role} → ${accountCode} missing in chart`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`Posting roles chart contract failed:\n${errors.join("\n")}`);
  }
}
