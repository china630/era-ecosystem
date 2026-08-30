/** Wave D — doctor bonus eligibility (pure). */

/**
 * In-quota package lines complete with amountNet 0 → not bonusEligible.
 * Over-quota / walk-in extras / Wave C 4th-same-day (amountNet > 0) → eligible.
 * Imported historical completions must never be eligible (caller skips before flag).
 */
export function resolveBonusEligible(input: {
  amountNet: number;
  importedHistorical?: boolean;
}): boolean {
  if (input.importedHistorical) return false;
  return Number(input.amountNet) > 0;
}

export function splitBonusBuckets(
  rows: Array<{ patientOrigin: string; amountNet: number }>,
): { grandTotalInHouse: number; grandTotalWalkIn: number; grandTotal: number } {
  let grandTotalInHouse = 0;
  let grandTotalWalkIn = 0;
  for (const r of rows) {
    const amt = Number(r.amountNet);
    if (r.patientOrigin === "IN_HOUSE") grandTotalInHouse += amt;
    else grandTotalWalkIn += amt;
  }
  return {
    grandTotalInHouse,
    grandTotalWalkIn,
    grandTotal: grandTotalInHouse + grandTotalWalkIn,
  };
}

export function applyBonusPercents(input: {
  grandTotalInHouse: number;
  grandTotalWalkIn: number;
  percentInHouse: number;
  percentWalkIn: number;
}): { bonusInHouse: number; bonusWalkIn: number; bonusTotal: number } {
  const bonusInHouse = (input.grandTotalInHouse * input.percentInHouse) / 100;
  const bonusWalkIn = (input.grandTotalWalkIn * input.percentWalkIn) / 100;
  return {
    bonusInHouse,
    bonusWalkIn,
    bonusTotal: bonusInHouse + bonusWalkIn,
  };
}
