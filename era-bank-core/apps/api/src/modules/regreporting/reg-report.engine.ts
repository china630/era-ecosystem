import { GlAccountType, InstitutionType } from "@era/bank-core-database";

export type TrialRow = {
  glAccountId: string;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
};

type GlMeta = {
  code: string;
  name: string;
  type?: GlAccountType;
};

export type RegReportAssemblyKind =
  | "TRIAL_BALANCE"
  | "BALANCE_SHEET_STUB"
  | "PNL_STUB"
  | "CREDIT_PORTFOLIO_PLACEHOLDER"
  | "CREDIT_PORTFOLIO_BY_CATEGORY"
  | "LCR_FROM_RISK_OR_GL"
  | "CAR_FROM_RISK";

export type CreditPortfolioCategoryRow = {
  categoryCode: string;
  outstandingMinor: string;
  provisionMinor: string;
  loanCount: number;
};

export type RegReportDefinition = {
  assembly: { kind: RegReportAssemblyKind };
  controlRatios?: ControlRatioCheck[];
  placeholderNote?: string;
};

export type ControlRatioCheck =
  | {
      code: string;
      operator: "eq";
      path: string;
      expected: boolean | string | number;
    }
  | {
      code: string;
      operator: "sum_eq_minor";
      leftPath: string;
      rightPaths: string[];
    }
  | {
      code: string;
      operator: "diff_eq_minor";
      leftPath: string;
      rightPath: string;
      resultPath: string;
    };

export type ControlRatioResult = {
  code: string;
  passed: boolean;
  detail?: string;
};

export type TemplateCandidate = {
  id: string;
  code: string;
  version: string;
  validFrom: Date;
  institutionType: InstitutionType | null;
  definitionJson: unknown;
  outputFormat: string;
};

export function parseRegReportDefinition(raw: unknown): RegReportDefinition {
  const def = raw as RegReportDefinition;
  if (!def?.assembly?.kind) {
    throw new Error("RegReportTemplate.definitionJson missing assembly.kind");
  }
  return def;
}

/** Pick the newest template row effective on `asOf` for the institution type. */
export function pickActiveRegReportTemplate(
  rows: TemplateCandidate[],
  institutionType: InstitutionType,
  asOf: Date,
): TemplateCandidate | null {
  const eligible = rows.filter(
    (r) =>
      r.validFrom <= asOf &&
      (r.institutionType == null || r.institutionType === institutionType),
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const byDate = b.validFrom.getTime() - a.validFrom.getTime();
    if (byDate !== 0) return byDate;
    return b.version.localeCompare(a.version);
  });
  return eligible[0] ?? null;
}

export function assembleGlReportPayload(
  templateCode: string,
  definition: RegReportDefinition,
  trialBalance: TrialRow[],
  glById: Map<string, GlMeta>,
  templateVersion?: string,
  creditCategories?: CreditPortfolioCategoryRow[],
): Record<string, unknown> {
  const base = {
    template: templateCode,
    templateVersion,
    assemblyKind: definition.assembly.kind,
    labExportOnly: true,
    note: "Lab assembly — not CBAR live submit / official XSD",
  };

  switch (definition.assembly.kind) {
    case "TRIAL_BALANCE":
      return { ...base, ...buildTrialBalanceOutput(trialBalance, glById) };
    case "BALANCE_SHEET_STUB":
      return { ...base, ...buildBalanceSheetStub(trialBalance, glById) };
    case "PNL_STUB":
      return { ...base, ...buildPnlStub(trialBalance, glById) };
    case "CREDIT_PORTFOLIO_PLACEHOLDER":
    case "CREDIT_PORTFOLIO_BY_CATEGORY": {
      const categories = creditCategories ?? [];
      const fromCats = categories.reduce(
        (s, c) => s + BigInt(c.outstandingMinor || "0"),
        0n,
      );
      const glTotal = sumLoanPrefixNet(trialBalance, glById);
      return {
        ...base,
        placeholder: categories.length === 0,
        note:
          categories.length === 0
            ? (definition.placeholderNote ??
              "Run CBAR prudential classification for category breakdown")
            : "Categories from latest COMPLETED prudential run",
        categories,
        loanPortfolioTotalMinor: (categories.length > 0 ? fromCats : glTotal).toString(),
      };
    }
    case "LCR_FROM_RISK_OR_GL":
    case "CAR_FROM_RISK":
      return { ...base, awaitingRiskAssembly: true };
    default:
      throw new Error(`Unsupported assembly kind: ${definition.assembly.kind}`);
  }
}

export function validateControlRatios(
  definition: RegReportDefinition,
  output: Record<string, unknown>,
): { passed: boolean; results: ControlRatioResult[] } {
  const checks = definition.controlRatios ?? [];
  const results: ControlRatioResult[] = checks.map((check) =>
    evaluateControlRatio(check, output),
  );
  return { passed: results.every((r) => r.passed), results };
}

function evaluateControlRatio(
  check: ControlRatioCheck,
  output: Record<string, unknown>,
): ControlRatioResult {
  if (check.operator === "eq") {
    const actual = getPathValue(output, check.path);
    const passed =
      typeof check.expected === "boolean"
        ? actual === check.expected
        : String(actual) === String(check.expected);
    return {
      code: check.code,
      passed,
      detail: passed ? undefined : `expected ${check.expected}, got ${String(actual)}`,
    };
  }

  if (check.operator === "sum_eq_minor") {
    const left = parseMinor(getPathValue(output, check.leftPath));
    const right = check.rightPaths
      .map((p) => parseMinor(getPathValue(output, p)))
      .reduce((a, b) => a + b, 0n);
    const passed = left === right;
    return {
      code: check.code,
      passed,
      detail: passed
        ? undefined
        : `left ${left.toString()} !== sum(right) ${right.toString()}`,
    };
  }

  const income = parseMinor(getPathValue(output, check.leftPath));
  const expense = parseMinor(getPathValue(output, check.rightPath));
  const computed = parseMinor(getPathValue(output, check.resultPath));
  const expectedNet = income - expense;
  const passed = computed === expectedNet;
  return {
    code: check.code,
    passed,
    detail: passed
      ? undefined
      : `computedNet ${computed.toString()} !== income-expense ${expectedNet.toString()}`,
  };
}

function getPathValue(root: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[key];
  }, root);
}

function parseMinor(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  return BigInt(String(v));
}

function buildTrialBalanceOutput(
  trialBalance: TrialRow[],
  glById: Map<string, GlMeta>,
) {
  const lines = trialBalance.map((row) => ({
    glCode: glById.get(row.glAccountId)?.code ?? row.glAccountId,
    glName: glById.get(row.glAccountId)?.name ?? "",
    debitMinor: row.debitMinor.toString(),
    creditMinor: row.creditMinor.toString(),
    currency: row.currency,
  }));
  let totalDebit = 0n;
  let totalCredit = 0n;
  for (const row of trialBalance) {
    totalDebit += row.debitMinor;
    totalCredit += row.creditMinor;
  }
  return {
    lines,
    totals: {
      debitMinor: totalDebit.toString(),
      creditMinor: totalCredit.toString(),
      balanced: totalDebit === totalCredit,
    },
  };
}

function buildBalanceSheetStub(
  trialBalance: TrialRow[],
  glById: Map<string, { code: string; name: string; type?: GlAccountType }>,
) {
  const buckets: Record<string, bigint> = {
    ASSET: 0n,
    LIABILITY: 0n,
    EQUITY: 0n,
  };
  for (const row of trialBalance) {
    const gl = glById.get(row.glAccountId);
    if (!gl?.type) continue;
    if (gl.type === GlAccountType.ASSET) buckets.ASSET += row.debitMinor - row.creditMinor;
    if (gl.type === GlAccountType.LIABILITY) buckets.LIABILITY += row.creditMinor - row.debitMinor;
    if (gl.type === GlAccountType.EQUITY) buckets.EQUITY += row.creditMinor - row.debitMinor;
  }
  const aggregatedByType = Object.fromEntries(
    Object.entries(buckets).map(([type, netMinor]) => [type, netMinor.toString()]),
  );
  return {
    aggregated: Object.entries(buckets).map(([type, netMinor]) => ({
      type,
      netMinor: netMinor.toString(),
    })),
    aggregatedByType,
  };
}

function buildPnlStub(
  trialBalance: TrialRow[],
  glById: Map<string, { code: string; type?: GlAccountType }>,
) {
  let incomeNet = 0n;
  let expenseNet = 0n;
  for (const row of trialBalance) {
    const gl = glById.get(row.glAccountId);
    if (!gl?.type) continue;
    if (gl.type === GlAccountType.INCOME) incomeNet += row.creditMinor - row.debitMinor;
    if (gl.type === GlAccountType.EXPENSE) expenseNet += row.debitMinor - row.creditMinor;
  }
  const computedNetMinor = incomeNet - expenseNet;
  return {
    incomeNetMinor: incomeNet.toString(),
    expenseNetMinor: expenseNet.toString(),
    computedNetMinor: computedNetMinor.toString(),
  };
}

function sumLoanPrefixNet(
  trialBalance: TrialRow[],
  glById: Map<string, { code: string; type?: GlAccountType }>,
): bigint {
  let total = 0n;
  for (const row of trialBalance) {
    const gl = glById.get(row.glAccountId);
    if (!gl?.code.startsWith("130")) continue;
    total += row.debitMinor - row.creditMinor;
  }
  return total;
}

/** GL fallback LCR stub (risk layer may override in service). */
export function buildLcrGlStub(
  template: string,
  trialBalance: TrialRow[],
  glById: Map<string, { code: string; type?: GlAccountType }>,
) {
  let liquidAssets = 0n;
  let outflows = 0n;
  for (const row of trialBalance) {
    const gl = glById.get(row.glAccountId);
    if (!gl) continue;
    if (gl.code.startsWith("100") || gl.code.startsWith("161")) {
      liquidAssets += row.debitMinor - row.creditMinor;
    }
    if (gl.type === GlAccountType.LIABILITY) {
      outflows += row.creditMinor - row.debitMinor;
    }
  }
  const ratio = outflows > 0n ? Number(liquidAssets) / Number(outflows) : 1;
  return {
    template,
    formula: "liquidAssets / liabilityOutflows (stub)",
    liquidAssetsMinor: liquidAssets.toString(),
    outflowsMinor: outflows.toString(),
    lcrRatio: ratio.toFixed(4),
  };
}