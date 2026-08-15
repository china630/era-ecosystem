const fs = require("fs");
const p = "era-clinic/src/components/LabOrderWorkflowModal.tsx";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("const [printOpen, setPrintOpen]")) {
  s = s.replace(
    'const [printNotice, setPrintNotice] = useState("");',
    'const [printNotice, setPrintNotice] = useState("");\n  const [printOpen, setPrintOpen] = useState(false);',
  );
}
if (!s.includes("setPrintOpen(false)")) {
  s = s.replace(
    'setPrintNotice("");',
    'setPrintNotice("");\n      setPrintOpen(false);',
  );
}

const oldBtn = `headerActions={
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setPrintNotice(t("printComingSoon"))}
          >
            {t("printButton")}
          </button>
        }`;

const newBtn = `headerActions={
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setPrintOpen(true)}
            disabled={!orderId}
          >
            {t("printButton")}
          </button>
        }`;

if (!s.includes(oldBtn)) {
  console.error("button block not found");
} else {
  s = s.replace(oldBtn, newBtn);
}

const insertBeforeReturn = `  const modalityCode =
    order?.items?.[0]?.diagnosticService?.modality?.code ??
    catalogItem?.modality ??
    "";
  const isImaging =
    /usg|usm|ultrasound|imaging/i.test(modalityCode) ||
    catalogItem?.kind === "imaging";
  const printHref = orderId
    ? isImaging
      ? \`/print/usm/\${orderId}\`
      : \`/print/lab-order/\${orderId}\`
    : null;

  return (`;

if (!s.includes("const printHref =")) {
  s = s.replace("  return (\n    <>\n      <ModalShell", insertBeforeReturn + "\n    <>\n      <ModalShell");
}

if (!s.includes("<PrintLanguageDialog")) {
  s = s.replace(
    "      </ModalShell>\n    </>\n  );\n}",
    `      </ModalShell>
      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
        title={t("printButton")}
      />
    </>
  );
}`,
  );
}

fs.writeFileSync(p, s, "utf8");
console.log("workflow modal patched", s.includes("PrintLanguageDialog"), s.includes("printHref"));
