/**
 * Tail chef copy leftovers (Spawn/DRAFT/outlet in hints). UTF-8.
 * Run: node scripts/ops/patch-chef-i18n-tail.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../messages");

function patch(file, mutator) {
  const p = path.join(root, file);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  mutator(j);
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
  console.log("patched", file);
}

patch("az.json", (j) => {
  Object.assign(j.admin.buffet, {
    templateHint:
      "Təkrarlanan Bazar ertəsi–Bazar × yemək şablonu. «Həftəni yarat» bir həftə üçün qaralama planlar yaradır (mövcud slotlar buraxılır).",
    spawnHint: "Seçilmiş həftənin bazar ertəsi götürülür. Mövcud nöqtə/tarix/yemək planları buraxılır.",
    manageOutletsLink: "Parametrlərdə nöqtələri idarə et",
    kindInModal: "Növ",
  });
  if (j.home) {
    /* leave */
  }
  if (j.nav && j.outletLabel !== undefined) {
    /* */
  }
  if (typeof j.outletLabel === "string") {
    j.outletLabel = "Aktiv nöqtə";
  }
});

patch("ru.json", (j) => {
  Object.assign(j.admin.buffet, {
    templateHint:
      "Повторяющийся шаблон Пн–Вс × приём. «Создать неделю» делает черновые планы на неделю (существующие слоты пропускаются).",
    spawnHint:
      "Берётся понедельник выбранной недели. Существующие планы точки/даты/приёма пропускаются.",
    manageOutletsLink: "Управлять точками в Параметрах",
    kindInModal: "Тип",
  });
  if (typeof j.outletLabel === "string") {
    j.outletLabel = "Активная точка";
  }
});

patch("en.json", (j) => {
  Object.assign(j.admin.buffet, {
    templateHint:
      "Repeating Mon–Sun × meal template. Create week makes DRAFT daily plans for one week (skips slots that already exist).",
    spawnHint: "Uses the Monday of the selected week. Existing outlet/date/meal plans are skipped.",
    manageOutletsLink: "Manage outlets in Settings",
    kindInModal: "Kind",
  });
});
