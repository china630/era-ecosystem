import {
  assertNoteRequiredFieldsFilled,
  listMissingRequiredFields,
  NOTE_REQUIRED_FIELDS,
} from "@/domain/notes/note-required";

describe("clinical note required fields", () => {
  const defs = [
    { key: "complaint", type: "textarea", label: { en: "Complaint", ru: "Жалоба", az: "Şikayət" }, required: true },
    { key: "plan", type: "textarea", label: { en: "Plan", ru: "План", az: "Plan" } },
  ];

  it("lists missing required keys", () => {
    expect(
      listMissingRequiredFields({
        fieldDefs: defs,
        fields: { complaint: "  ", plan: "Rest" },
      }),
    ).toEqual([{ key: "complaint", label: "Complaint" }]);
  });

  it("throws NOTE_REQUIRED_FIELDS when signing would fail validation", () => {
    expect(() =>
      assertNoteRequiredFieldsFilled({
        fieldDefs: defs,
        fields: {},
      }),
    ).toThrow(/missing/i);
    try {
      assertNoteRequiredFieldsFilled({ fieldDefs: defs, fields: {} });
    } catch (err) {
      expect((err as { code?: string }).code).toBe(NOTE_REQUIRED_FIELDS);
    }
  });

  it("passes when all required fields are filled", () => {
    expect(() =>
      assertNoteRequiredFieldsFilled({
        fieldDefs: defs,
        fields: { complaint: "Headache", plan: "" },
      }),
    ).not.toThrow();
  });
});