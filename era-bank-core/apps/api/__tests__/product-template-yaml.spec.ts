import { ProductKind } from "@era/bank-core-database";
import {
  diffProductTemplateYaml,
  exportProductTemplateYaml,
  parseProductTemplateYaml,
  readProductTemplateYamlVersion,
  stampProductTemplateYamlVersion,
} from "../src/kernel/product-factory/product-template-yaml.util";

describe("product template YAML roundtrip", () => {
  it("preserves kind and name through export and import", () => {
    const yaml = exportProductTemplateYaml({
      kind: ProductKind.TERM_DEPOSIT,
      name: "Retail term 12m",
      currency: "AZN",
    });
    const parsed = parseProductTemplateYaml(yaml);
    expect(parsed.kind).toBe(ProductKind.TERM_DEPOSIT);
    expect(parsed.name).toBe("Retail term 12m");
    expect(parsed.currency).toBe("AZN");
  });

  it("stamps version and diffs two blobs", () => {
    const left = stampProductTemplateYamlVersion(
      exportProductTemplateYaml({
        kind: ProductKind.TERM_DEPOSIT,
        name: "A",
        currency: "AZN",
      }),
      "1",
    );
    const right = stampProductTemplateYamlVersion(
      exportProductTemplateYaml({
        kind: ProductKind.TERM_DEPOSIT,
        name: "B",
        currency: "AZN",
      }),
      "2",
    );
    expect(readProductTemplateYamlVersion(left)).toBe("1");
    expect(readProductTemplateYamlVersion(right)).toBe("2");
    const diff = diffProductTemplateYaml(left, right);
    expect(diff.changed.some((c) => c.line === "name")).toBe(true);
    expect(diff.leftVersion).toBe("1");
    expect(diff.rightVersion).toBe("2");
  });
});