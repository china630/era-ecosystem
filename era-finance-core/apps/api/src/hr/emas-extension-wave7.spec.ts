/**
 * Extension-side Wave 7 unit checks (VOEN detect, no internalRate, mapping version).
 * Lives under api Jest (ts-jest) — extension package has no Jest runner.
 */
import {
  detectEmasActiveVoen,
  extractVoenFromText,
} from "../../../extension/src/connectors/emas/auth-detect";
import {
  EMAS_FIELD_MAPPING_VERSION,
  looksLikeEmasSignControl,
} from "../../../extension/src/connectors/emas/selectors";
import {
  EmasFieldMappingError,
  mapPrefillToFields,
} from "../../../extension/src/connectors/emas/adapters/erp-to-muqavile";

function makeEl(
  tag: string,
  opts: { text?: string; name?: string; attrs?: Record<string, string> } = {},
): HTMLElement {
  const el = {
    tagName: tag.toUpperCase(),
    textContent: opts.text ?? "",
    title: "",
    name: opts.name ?? "",
    id: "",
    placeholder: "",
    value: "",
    focus: () => undefined,
    dispatchEvent: () => true,
    getAttribute: (k: string) => opts.attrs?.[k] ?? null,
  } as unknown as HTMLElement;
  return el;
}

function makeDocWithInputs(names: string[]): Document {
  const inputs = names.map((name) => makeEl("input", { name }));
  return {
    querySelectorAll: () => inputs as unknown as NodeListOf<Element>,
  } as unknown as Document;
}

describe("EMAS extension wave 7", () => {
  it("exports mapping version", () => {
    expect(EMAS_FIELD_MAPPING_VERSION).toBe(1);
  });

  it("extractVoenFromText picks first 10-digit group", () => {
    expect(extractVoenFromText("Company VÖEN: 1234567890 OK")).toBe("1234567890");
    expect(extractVoenFromText("12345678901")).toBeNull();
  });

  it("detectActiveVoen finds 10-digit VOEN in candidate nodes", async () => {
    const node = makeEl("div", { text: "Company VOEN: 1234567890" });
    const doc = {
      querySelectorAll: (sel: string) => {
        if (String(sel).includes("company") || String(sel).includes("voen")) {
          return [node] as unknown as NodeListOf<Element>;
        }
        return [] as unknown as NodeListOf<Element>;
      },
      body: { innerText: "" },
    } as unknown as Document;
    await expect(detectEmasActiveVoen(doc)).resolves.toBe("1234567890");
  });

  it("looksLikeEmasSignControl matches Imzala label", () => {
    const btn = makeEl("button", { text: "Imzala" });
    const az = makeEl("button", { text: "İmzala" });
    expect(looksLikeEmasSignControl(az)).toBe(true);
    expect(looksLikeEmasSignControl(btn)).toBe(true);
  });

  it("mapPrefillToFields rejects internalRate", () => {
    const doc = makeDocWithInputs(["salary"]);
    expect(() =>
      mapPrefillToFields(
        {
          employeeId: "e1",
          firstName: "A",
          lastName: "B",
          finCode: "ABC1234",
          positionTitle: "X",
          departmentName: null,
          salaryGrossAzn: "1000.00",
          contractStartDate: "2026-01-01",
          emasStatus: "READY",
          internalRate: "2000",
        } as never,
        doc,
      ),
    ).toThrow(EmasFieldMappingError);
  });

  it("mapPrefillToFields rejects PENDING_FIN", () => {
    const doc = makeDocWithInputs(["ad", "soyad", "fin", "salary"]);
    expect(() =>
      mapPrefillToFields(
        {
          employeeId: "e1",
          firstName: "A",
          lastName: "B",
          finCode: null,
          positionTitle: null,
          departmentName: null,
          salaryGrossAzn: "1000.00",
          contractStartDate: null,
          emasStatus: "PENDING_FIN",
        },
        doc,
      ),
    ).toThrow(/not READY|FIN/i);
  });

  it("mapPrefillToFields rejects mapping version mismatch", () => {
    const doc = makeDocWithInputs(["ad", "soyad", "fin", "salary"]);
    expect(() =>
      mapPrefillToFields(
        {
          employeeId: "e1",
          firstName: "A",
          lastName: "B",
          finCode: "ABC1234",
          positionTitle: null,
          departmentName: null,
          salaryGrossAzn: "1000.00",
          contractStartDate: null,
          emasStatus: "READY",
          mappingVersion: 99,
        },
        doc,
      ),
    ).toThrow(/mapping version mismatch/);
  });

  it("mapPrefillToFields errors when critical DOM fields missing", () => {
    const doc = makeDocWithInputs(["unrelated"]);
    expect(() =>
      mapPrefillToFields(
        {
          employeeId: "e1",
          firstName: "A",
          lastName: "B",
          finCode: "ABC1234",
          positionTitle: null,
          departmentName: null,
          salaryGrossAzn: "1000.00",
          contractStartDate: null,
          emasStatus: "READY",
        },
        doc,
      ),
    ).toThrow(/DOM mapping failed/);
  });
});

describe("queueItemsForPrefill", () => {
  function queueItemsForPrefill(
    items: Array<{
      employeeId: string;
      finPending?: boolean;
      finCode?: string | null;
      salaryGrossAzn?: string;
    }>,
  ) {
    return items.filter((row) => {
      if (row.finPending) return false;
      if (!row.finCode) return false;
      const sal = Number(row.salaryGrossAzn ?? 0);
      if (!Number.isFinite(sal) || sal <= 0) return false;
      return true;
    });
  }

  it("keeps READY rows with FIN and salary > 0", () => {
    const out = queueItemsForPrefill([
      {
        employeeId: "a",
        finPending: false,
        finCode: "ABC1234",
        salaryGrossAzn: "500",
      },
      {
        employeeId: "b",
        finPending: true,
        finCode: null,
        salaryGrossAzn: "500",
      },
      {
        employeeId: "c",
        finPending: false,
        finCode: "XYZ9876",
        salaryGrossAzn: "0",
      },
    ]);
    expect(out.map((x) => x.employeeId)).toEqual(["a"]);
  });
});
