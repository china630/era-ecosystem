import {
  attributePosLinesForCostRun,
  classifyPosLineForCostRun,
  isCompPaymentMethod,
} from "@/lib/buffet-comp-attribution";
import { buildCostRunAttributionSlices } from "@/lib/staff-buffet-overlap";

describe("buffet COMP / zero-price attribution (Wave 4)", () => {
  it("tags unitPrice 0 as COMP (ZERO_PRICE)", () => {
    const c = classifyPosLineForCostRun({
      unitPriceAzn: 0,
      kitchenStatus: "DONE",
      paymentMethod: "CASH",
    });
    expect(c).toEqual({ bucket: "COMP", tagReason: "ZERO_PRICE" });
  });

  it("tags COMP tender as COMP even when priced", () => {
    expect(isCompPaymentMethod("gift")).toBe(true);
    const c = classifyPosLineForCostRun({
      unitPriceAzn: 12,
      kitchenStatus: "DONE",
      paymentMethod: "COMP",
    });
    expect(c).toEqual({ bucket: "COMP", tagReason: "COMP_TENDER" });
  });

  it("skips VOID lines", () => {
    expect(
      classifyPosLineForCostRun({
        unitPriceAzn: 0,
        kitchenStatus: "VOID",
        paymentMethod: "CASH",
      }),
    ).toBeNull();
  });

  it("named COMP bucket + sale sum into posAttributed; warns missing SKU", () => {
    const result = attributePosLinesForCostRun(
      [
        {
          lineId: "l1",
          ticketId: "t1",
          qty: 2,
          unitPriceAzn: 10,
          kitchenStatus: "DONE",
          paymentMethod: "CASH",
          recipeSku: "R-STEAK",
          plu: "F1",
          description: "Steak",
        },
        {
          lineId: "l2",
          ticketId: "t2",
          qty: 1,
          unitPriceAzn: 0,
          kitchenStatus: "DONE",
          paymentMethod: "CASH",
          recipeSku: "R-CAKE",
          plu: "F2",
          description: "Comp cake",
        },
        {
          lineId: "l3",
          ticketId: "t3",
          qty: 1,
          unitPriceAzn: 0,
          kitchenStatus: "DONE",
          paymentMethod: "CASH",
          recipeSku: null,
          plu: "F3",
          description: "Gift no sku",
        },
      ],
      { unitCogsBySku: { "R-STEAK": 4, "R-CAKE": 3 } },
    );

    expect(result.saleAttributedAzn).toBe(8);
    expect(result.compAttributedAzn).toBe(3);
    expect(result.posAttributedAzn).toBe(11);
    expect(result.compLineCount).toBe(2);
    expect(result.saleLineCount).toBe(1);
    expect(result.warnings.some((w) => w.code === "MISSING_RECIPE_SKU")).toBe(true);
    expect(result.lines.find((l) => l.lineId === "l2")?.bucket).toBe("COMP");
  });

  it("warns MISSING_UNIT_COGS when SKU present but no map", () => {
    const result = attributePosLinesForCostRun(
      [
        {
          lineId: "l1",
          ticketId: "t1",
          qty: 1,
          unitPriceAzn: 0,
          kitchenStatus: "DONE",
          paymentMethod: "CASH",
          recipeSku: "R-X",
          plu: "X",
        },
      ],
      {},
    );
    expect(result.compAttributedAzn).toBe(0);
    expect(result.warnings[0]?.code).toBe("MISSING_UNIT_COGS");
  });

  it("COMP_TENDER wins over non-zero price", () => {
    const result = attributePosLinesForCostRun(
      [
        {
          lineId: "l1",
          ticketId: "t1",
          qty: 2,
          unitPriceAzn: 15,
          kitchenStatus: "DONE",
          paymentMethod: "HOUSE",
          recipeSku: "R1",
        },
      ],
      { unitCogsBySku: { R1: 1.5 } },
    );
    expect(result.compLineCount).toBe(1);
    expect(result.saleLineCount).toBe(0);
    expect(result.compAttributedAzn).toBe(3);
  });

  it("cost-run fixture: COMP in posAttributed — not silent residual only", () => {
    const pos = attributePosLinesForCostRun(
      [
        {
          lineId: "sale",
          ticketId: "t",
          qty: 1,
          unitPriceAzn: 20,
          kitchenStatus: "DONE",
          paymentMethod: "CARD",
          recipeSku: "A",
        },
        {
          lineId: "comp",
          ticketId: "t",
          qty: 1,
          unitPriceAzn: 0,
          kitchenStatus: "DONE",
          paymentMethod: "CARD",
          recipeSku: "B",
        },
      ],
      { unitCogsBySku: { A: 5, B: 7 } },
    );
    expect(pos.compAttributedAzn).toBe(7);
    expect(pos.saleAttributedAzn).toBe(5);

    const slices = buildCostRunAttributionSlices({
      foodUsage: 100,
      posAttributed: pos.posAttributedAzn,
      staffGross: 0,
      mode: "SEPARATE_CENTER",
      overlapPct: 30,
    });
    // Without COMP in pos, residual would be 95; with COMP it is 88
    expect(slices.posAttributed).toBe(12);
    expect(slices.residualBuffet).toBe(88);
    expect(slices.attributed).toBe(12);
  });
});
