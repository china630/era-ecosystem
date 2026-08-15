const fs = require("fs");
const p = "era-clinic/src/components/PatientCardClinicalSections.tsx";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("PrintLanguageDialog")) {
  s = s.replace(
    'import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";',
    `import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";`,
  );
}

if (!s.includes("printHref")) {
  // find component function and add state after first useState block - insert near other useState
  const stateMarker = "const [historyOpen, setHistoryOpen] = useState(false);";
  if (s.includes(stateMarker) && !s.includes("setPrintHref")) {
    s = s.replace(
      stateMarker,
      `${stateMarker}
  const [printHref, setPrintHref] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);`,
    );
  } else if (!s.includes("setPrintHref")) {
    // try alternate
    const m = "const [planOpen, setPlanOpen] = useState(false);";
    if (s.includes(m)) {
      s = s.replace(
        m,
        `${m}
  const [printHref, setPrintHref] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);`,
      );
    }
  }
}

function openPrintHelper() {
  return `function openPrint(href: string) {
    setPrintHref(href);
    setPrintOpen(true);
  }

  function labPrintHref(ev: TimelineEvent): string | null {
    const m = (ev.href || "").match(/lab-orders\\/([^/?#]+)/);
    if (!m) return null;
    const id = m[1];
    const title = (ev.titleL10n ? pickL10n(ev.titleL10n, "en") : ev.title).toLowerCase();
    if (/usg|usm|ultrasound|abdomen/.test(title)) return \`/print/usm/\${id}\`;
    return \`/print/lab-order/\${id}\`;
  }`;
}

if (!s.includes("function openPrint(")) {
  s = s.replace(
    "  const { nowNext, resultsPreview, planPreview } = summary;",
    `  ${openPrintHelper()}

  const { nowNext, resultsPreview, planPreview } = summary;`,
  );
}

// Results section header buttons
if (!s.includes("printCheckup")) {
  s = s.replace(
    `{t("openHistory")}
          </button>
        </div>
        <div className={\`\${CARD_CONTAINER_CLASS} p-4\`}>
          {resultsPreview.length === 0 ? (`,
    `{t("openHistory")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => openPrint(\`/print/checkup/\${patientRefId}\`)}
          >
            {t("printCheckup", { defaultValue: "Print check-up" })}
          </button>
        </div>
        <div className={\`\${CARD_CONTAINER_CLASS} p-4\`}>
          {resultsPreview.length === 0 ? (`,
  );
}

// Per-result print button
if (!s.includes("labPrintHref(ev)")) {
  s = s.replace(
    `{ev.hasCritical ? (
                        <span className={\`ml-2 \${TEXT_DANGER_CLASS}\`}>{t("critical")}</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("proposedPlanTitle", { defaultValue: "Proposed plan" })}`,
    `{ev.hasCritical ? (
                        <span className={\`ml-2 \${TEXT_DANGER_CLASS}\`}>{t("critical")}</span>
                      ) : null}
                    </p>
                  </div>
                  {labPrintHref(ev) ? (
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => openPrint(labPrintHref(ev)!)}
                    >
                      {t("print", { defaultValue: "Print" })}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("proposedPlanTitle", { defaultValue: "Proposed plan" })}`,
  );
}

// Plan section print procedures
if (!s.includes("printProcedures")) {
  s = s.replace(
    `<button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPlanOpen(true)}>
            {t("openPlan")}
          </button>
        </div>
        <div className={\`\${CARD_CONTAINER_CLASS} p-4\`}>
          {planPreview.length === 0 ? (`,
    `<button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPlanOpen(true)}>
            {t("openPlan")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => openPrint(\`/print/procedures/\${patientRefId}\`)}
          >
            {t("printProcedures", { defaultValue: "Print schedule" })}
          </button>
        </div>
        <div className={\`\${CARD_CONTAINER_CLASS} p-4\`}>
          {planPreview.length === 0 ? (`,
  );
}

if (!s.includes("<PrintLanguageDialog")) {
  // append before final closing of component return - find last `</>` before end
  const idx = s.lastIndexOf("    </>\n  );\n}");
  if (idx > 0) {
    s =
      s.slice(0, idx) +
      `      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
      />
` +
      s.slice(idx);
  }
}

fs.writeFileSync(p, s, "utf8");
console.log("patient card", {
  dialog: s.includes("PrintLanguageDialog"),
  checkup: s.includes("printCheckup"),
  procedures: s.includes("printProcedures"),
  labHref: s.includes("labPrintHref"),
  state: s.includes("setPrintHref"),
});
