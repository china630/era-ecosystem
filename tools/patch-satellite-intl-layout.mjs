#!/usr/bin/env node
/** Patch satellite layouts (locale prop) and login/help (SatelliteLocaleToggle). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const APPS = [
  "era-clinic",
  "era-retail-pos",
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
  "era-wholesale",
  "era-fnb-pos",
  "era-hotel-pms",
];

const ORCH_LAYOUT = "era-orchestrator/apps/web/app/layout.tsx";

function patchLayout(file) {
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes('export const dynamic = "force-dynamic"')) return;

  if (!s.includes("eraIntlOnError")) {
    s = s.replace(
      /from "@era\/i18n-common";?\n/,
      'from "@era/i18n-common";\nimport { eraIntlMessageFallback, eraIntlOnError } from "@era/i18n-common";\n',
    );
    if (!s.includes("eraIntlOnError")) {
      s = s.replace(
        /from '@era\/i18n-common';?\n/,
        "from '@era/i18n-common';\nimport { eraIntlMessageFallback, eraIntlOnError } from '@era/i18n-common';\n",
      );
    }
  }

  s = s.replace(
    /<NextIntlClientProvider messages=\{messages\}>/g,
    '<NextIntlClientProvider locale={locale} messages={messages} onError={eraIntlOnError} getMessageFallback={eraIntlMessageFallback}>',
  );

  const insertAfter = s.match(/^import .+\n(?:import .+\n)*/)?.[0]?.length;
  if (insertAfter && !s.includes('export const dynamic')) {
    s = `${s.slice(0, insertAfter)}\nexport const dynamic = "force-dynamic";\n${s.slice(insertAfter)}`;
  }

  fs.writeFileSync(file, s, "utf8");
  console.log("layout:", file);
}

function patchLoginHelp(dir) {
  for (const rel of ["app/login/page.tsx", "app/help/page.tsx"]) {
    const file = path.join(root, dir, rel);
    if (!fs.existsSync(file)) continue;
    let s = fs.readFileSync(file, "utf8");
    if (s.includes("SatelliteLocaleToggle")) continue;

    s = s.replace(/\bLocaleToggle\b/g, "SatelliteLocaleToggle");
    s = s.replace(
      /import \{([^}]*?)LocaleToggle,/,
      "import {$1SatelliteLocaleToggle,",
    );
    s = s.replace(
      /,\s*LocaleToggle\s*\}/,
      ", SatelliteLocaleToggle }",
    );
    s = s.replace(
      /,\s*LocaleToggle,/,
      ", SatelliteLocaleToggle,",
    );

    // Remove broken onChange / local lang state for help pages
    s = s.replace(
      /<SatelliteLocaleToggle locale=\{locale\} onChange=\{\(\) => router\.refresh\(\)\} \/>/g,
      "<SatelliteLocaleToggle />",
    );
    s = s.replace(
      /<SatelliteLocaleToggle locale=\{locale\} onChange=\{\(\) => router\.refresh\(\)\} \/>/g,
      "<SatelliteLocaleToggle />",
    );
    s = s.replace(
      /<SatelliteLocaleToggle locale=\{lang\} onChange=\{setLang\} \/>/g,
      "<SatelliteLocaleToggle />",
    );

    // Drop unused useState(lang) in help pages when possible
    s = s.replace(/import \{ useMemo, useState \}/, "import { useMemo }");
    s = s.replace(/import \{ useMemo, useState \}/, "import { useMemo }");
    s = s.replace(/\s*const \[lang, setLang\] = useState\(locale\);\n/, "\n");
    s = s.replace(/locale=\{lang\}/g, "locale={locale}");

    fs.writeFileSync(file, s, "utf8");
    console.log("page:", file);
  }
}

for (const dir of APPS) {
  patchLayout(path.join(root, dir, "app/layout.tsx"));
  patchLoginHelp(dir);
}

patchLayout(path.join(root, ORCH_LAYOUT));

const orchLogin = path.join(root, "era-orchestrator/apps/web/app/login/page.tsx");
const orchHelp = path.join(root, "era-orchestrator/apps/web/app/help/page.tsx");
for (const file of [orchLogin, orchHelp]) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("SatelliteLocaleToggle")) continue;
  s = s.replace(/\bLocaleToggle\b/g, "SatelliteLocaleToggle");
  s = s.replace("LocaleToggle,", "SatelliteLocaleToggle,");
  s = s.replace(
    /<SatelliteLocaleToggle locale=\{locale\} onChange=\{\(\) => router\.refresh\(\)\} \/>/g,
    "<SatelliteLocaleToggle />",
  );
  fs.writeFileSync(file, s, "utf8");
  console.log("page:", file);
}
