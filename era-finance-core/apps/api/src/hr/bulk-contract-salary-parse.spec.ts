import * as fs from "fs";
import * as path from "path";
import { parseBulkContractSalaryCsv } from "./bulk-contract-salary-parse";

const VALID_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("parseBulkContractSalaryCsv", () => {
  it("skips header row without counting as skipped", () => {
    const { items, skipped } = parseBulkContractSalaryCsv(
      `employeeId,salary\n${VALID_ID},1500`,
    );
    expect(items).toHaveLength(1);
    expect(skipped).toHaveLength(0);
    expect(items[0]).toEqual({ employeeId: VALID_ID, salary: 1500 });
  });

  it("skips employee_id header variant", () => {
    const { items, skipped } = parseBulkContractSalaryCsv(
      `employee_id,salary\n${VALID_ID},2000`,
    );
    expect(items).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it("reports too_few_columns with 1-based line numbers including blank lines", () => {
    const { items, skipped } = parseBulkContractSalaryCsv(
      `\nonly-one-col\n${VALID_ID},1000`,
    );
    expect(items).toHaveLength(1);
    expect(skipped).toEqual([
      { line: 2, reason: "too_few_columns", raw: "only-one-col" },
    ]);
  });

  it("prefers bad_uuid over salary_not_positive", () => {
    const { skipped } = parseBulkContractSalaryCsv("not-a-uuid,-5");
    expect(skipped).toEqual([
      { line: 1, reason: "bad_uuid", raw: "not-a-uuid,-5" },
    ]);
  });

  it("reports salary_not_positive for valid uuid with bad salary", () => {
    const { skipped } = parseBulkContractSalaryCsv(`${VALID_ID},0`);
    expect(skipped).toEqual([
      { line: 1, reason: "salary_not_positive", raw: `${VALID_ID},0` },
    ]);
  });

  it("parses optional internalRate column", () => {
    const { items } = parseBulkContractSalaryCsv(`${VALID_ID},1200,800`);
    expect(items[0]).toEqual({
      employeeId: VALID_ID,
      salary: 1200,
      internalRate: 800,
    });
  });

  it("stays in sync with web/lib/bulk-contract-salary-csv.ts", () => {
    const apiSrc = fs
      .readFileSync(path.join(__dirname, "bulk-contract-salary-parse.ts"), "utf8")
      .replace(/\r\n/g, "\n")
      .trim();
    const webSrc = fs
      .readFileSync(
        path.join(__dirname, "../../../web/lib/bulk-contract-salary-csv.ts"),
        "utf8",
      )
      .replace(/\r\n/g, "\n")
      .replace(
        /^\/\*\* Keep in sync with apps\/api\/src\/hr\/bulk-contract-salary-parse.ts \*\/\n\n/,
        "",
      )
      .trim();
    expect(webSrc).toBe(apiSrc);
  });
});
