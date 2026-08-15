const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../../..");

function patchFieldSystem() {
  const p = path.join(root, "docs/FIELD_SYSTEM_MODAL_WAVES.md");
  let t = fs.readFileSync(p, "utf8");
  if (t.includes("| **C** | era-clinic |")) {
    console.log("FIELD_SYSTEM already has C");
    return;
  }
  t = t.replace(
    "| **F6** | era-finance-core | CreateCounterpartyModal, employee-modal | Done |\n",
    "| **F6** | era-finance-core | CreateCounterpartyModal, employee-modal | Done |\n| **C** | era-clinic | Hex→L3 token sweep (admin, patient/lab, sanatorium, ops chrome, remainder); Field*/DatePicker on remaining modals | Done |\n",
  );
  if (!t.includes("## Wave C — clinic")) {
    t =
      t.trimEnd() +
      "\n\n## Wave C — clinic 3-tier token rebuild\n\nOrdered hex→L3 + Field* sweep for era-clinic (C1 SatAdmin → C2 Patient/Lab → C3 Sanatorium → C4 Ops canvases chrome → C5 remainder). Spec: [adr/era-design-tokens-3tier.md](./adr/era-design-tokens-3tier.md). Ops canvases keep layout; colors/buttons via kit. Baseline: `era-clinic` `raw-input-no-token` shrunk to 0 (lint scans `src/`; checkboxes use `MODAL_CHECKBOX_CLASS`).\n";
  }
  fs.writeFileSync(p, t, "utf8");
  console.log("updated FIELD_SYSTEM");
}

function patchDelivery() {
  const p = path.join(root, "era-clinic/doc/DELIVERY-CLINIC.md");
  let t = fs.readFileSync(p, "utf8");
  if (t.includes("3-tier design tokens")) {
    console.log("DELIVERY already notes tokens");
    return;
  }
  const block = `## UI / design tokens (Wave C)

- [x] 3-tier design tokens (L1/L2/L3) + Field* sweep — SatAdmin, patient/lab, sanatorium, ops chrome, remainder ([FIELD_SYSTEM_MODAL_WAVES.md](../../docs/FIELD_SYSTEM_MODAL_WAVES.md) wave **C**; ADR [era-design-tokens-3tier.md](../../docs/adr/era-design-tokens-3tier.md))
- [x] \`lint:design-tokens\` — era-clinic \`raw-input-no-token\` = 0

`;
  const marker = "### Env (prod example)";
  if (t.includes(marker)) {
    t = t.replace(marker, block + marker);
  } else {
    t = t.trimEnd() + "\n\n" + block;
  }
  fs.writeFileSync(p, t, "utf8");
  console.log("updated DELIVERY");
}

function patchUat() {
  const p = path.join(root, "era-clinic/doc/UAT-SMOKE.md");
  let t = fs.readFileSync(p, "utf8");
  if (t.includes("Design tokens visual (Wave C)")) {
    console.log("UAT already has visual");
    return;
  }
  const section = `### Design tokens visual (Wave C)

1. **/admin/settings** + **/admin/procedure-rules** — Field*/kit buttons; no raw hex chrome; save works.
2. **/patients/[id]** — proposed confirm + body-part selects use Field*; muted/danger text via kit classes.
3. **/nurse** + **/sanatorium** — agenda/matrix layout unchanged; primary/success/danger/muted match DESIGN.md via kit tokens.
4. **/lab-orders** create (external) — DatePicker + FieldSelect; no native date-only chrome.

`;
  if (t.includes("\n### Pattern B outpatient")) {
    t = t.replace("\n### Pattern B outpatient", "\n" + section + "### Pattern B outpatient");
  } else {
    t = t.trimEnd() + "\n\n" + section;
  }
  fs.writeFileSync(p, t, "utf8");
  console.log("updated UAT");
}

patchFieldSystem();
patchDelivery();
patchUat();
