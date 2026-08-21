/** Pure math for HOT-CO-04 (mirrors early-checkout-unused-nights.service). */
function computeUnusedNightsRefund(unusedSellGross: number, vatRate = 0.18) {
  const gross = Math.round(Math.max(0, unusedSellGross) * 100) / 100;
  if (gross <= 0) {
    return { unusedSellGross: 0, vatWithheld: 0, refundNet: 0, vatRate };
  }
  const refundNet = Math.floor((gross / (1 + vatRate)) * 100) / 100;
  const vatWithheld = Math.round((gross - refundNet) * 100) / 100;
  return { unusedSellGross: gross, vatWithheld, refundNet, vatRate };
}

describe("computeUnusedNightsRefund", () => {
  it("118 gross → 100 net, 18 VAT withheld (house-favoring)", () => {
    const r = computeUnusedNightsRefund(118);
    expect(r.refundNet).toBe(100);
    expect(r.vatWithheld).toBe(18);
    expect(r.unusedSellGross).toBe(118);
  });

  it("zero unused → zeros", () => {
    expect(computeUnusedNightsRefund(0)).toEqual({
      unusedSellGross: 0,
      vatWithheld: 0,
      refundNet: 0,
      vatRate: 0.18,
    });
  });
});
