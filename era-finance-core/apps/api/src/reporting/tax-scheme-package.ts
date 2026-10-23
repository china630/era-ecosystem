/**
 * One statutory scheme row for every placement.
 * SaaS and on-prem apply this package. Recalculation stays in SchemePeriodService.
 */
export const AZ_STATUTORY_SCHEME_PACKAGE = {
  id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  code: "AZ_STATUTORY",
  effectiveFrom: "2020-01-01",
  parameters: {
    vatThresholdAzn: "200000",
    posCoefficient: "0.5",
    eqaimeShareLimit: "0.30",
    defaultSimplifiedPercent: "2",
    posSimplifiedPercent: "6",
    posRateEffectiveFrom: "2026-01-01",
    posRateEffectiveTo: "2028-12-31",
    vatPercent: "18",
  },
  nameAz: "Azərbaycan vergi sxemi",
  nameRu: "Налоговая схема Азербайджана",
  nameEn: "Azerbaijan statutory tax scheme",
} as const;

type SchemeDb = {
  taxSchemeVersion: {
    upsert: (args: {
      where: { code_effectiveFrom: { code: string; effectiveFrom: Date } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};

export function applyStatutorySchemePackage(db: SchemeDb) {
  const effectiveFrom = new Date(`${AZ_STATUTORY_SCHEME_PACKAGE.effectiveFrom}T00:00:00.000Z`);
  return db.taxSchemeVersion.upsert({
    where: {
      code_effectiveFrom: { code: AZ_STATUTORY_SCHEME_PACKAGE.code, effectiveFrom },
    },
    create: {
      id: AZ_STATUTORY_SCHEME_PACKAGE.id,
      code: AZ_STATUTORY_SCHEME_PACKAGE.code,
      effectiveFrom,
      parameters: AZ_STATUTORY_SCHEME_PACKAGE.parameters,
      nameAz: AZ_STATUTORY_SCHEME_PACKAGE.nameAz,
      nameRu: AZ_STATUTORY_SCHEME_PACKAGE.nameRu,
      nameEn: AZ_STATUTORY_SCHEME_PACKAGE.nameEn,
    },
    update: {
      parameters: AZ_STATUTORY_SCHEME_PACKAGE.parameters,
      nameAz: AZ_STATUTORY_SCHEME_PACKAGE.nameAz,
      nameRu: AZ_STATUTORY_SCHEME_PACKAGE.nameRu,
      nameEn: AZ_STATUTORY_SCHEME_PACKAGE.nameEn,
    },
  });
}
