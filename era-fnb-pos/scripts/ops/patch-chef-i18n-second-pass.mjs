/**
 * Second-pass chef copy leftovers (UTF-8).
 * Run: node scripts/ops/patch-chef-i18n-second-pass.mjs
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
    template: "Şablon",
    costRunHint:
      "Aşpaz yolu: POS satış + sıfır qiymət + personal net + nəzəri Proqnoz Finance-ə gedir. FOOD qalığı Finance anbarlarında hesablanır — bir kliklə Finance HYBRID açın.",
    costRunLoadFailed: "Hesabat yüklənmədi",
    costRunFinanceLink: "Finance HYBRID maya hesabatını aç",
    forecastHint:
      "Qonaq gecələri (əl ilə və ya əl ilə cəm) × əsas SKU normaları → zolaq + satınalma proqnozu. Canlı otel axını sonra.",
    forecastNoGuestNights: "Dövr üçün qonaq gecəsi yoxdur — aşağıda əlavə edin.",
    forecastNormsAllZero: "Bütün SKU AZN normaları 0-dır — nəzəri hesabat 0 olacaq.",
    staffPlanInactiveHint:
      "Qeyri-aktiv plan proqnoz və maya export-a düşmür — istifadə üçün Aktiv et.",
    rollupCaption:
      "Qonaq gecələri Proqnoz pack-ə (nəzəri) gedir. Meal cəmi = plan + rəhbərlik + personal — qonaq gecəsi deyil.",
    rollupForecastTotal: "Yemək proqnozu cəmi",
    spawnHint: "Həftəni şablondan yarat — mövcud slotlar buraxılır.",
  });
  j.admin.buffet.chefWarning = {
    ...j.admin.buffet.chefWarning,
    NO_GUEST_NIGHTS: "Dövr üçün qonaq gecələri yoxdur — nəzəri 0 olacaq.",
    NORMS_ALL_ZERO: "Bütün əsas SKU AZN normaları 0-dır — Normalarda doldurun.",
  };
  if (j.admin.settings) {
    j.admin.settings.buffetCostHint =
      "Canlı HYBRID: Maya dəyəri POS satış + sıfır qiymət + personal net + nəzəri Proqnoz yığır, sonra Finance-də FOOD qalığı. Outlet əlavə qaydası istəyə bağlıdır.";
  }
});

patch("ru.json", (j) => {
  Object.assign(j.nav, {
    buffetForecast: "Прогноз",
    buffetCostRun: "Себестоимость",
  });
  Object.assign(j.admin.buffet, {
    template: "Шаблон",
    costRunHint:
      "Шеф-путь: POS продажи + нулевая цена + персонал net + теория Прогноза уходят в Finance. Расход FOOD считает Finance — откройте Finance HYBRID одним кликом.",
    costRunLoadFailed: "Не удалось загрузить расчёт",
    costRunFinanceLink: "Открыть Finance HYBRID себестоимость",
    forecastHint:
      "Гостевые ночи (вручную или ручная сумма) × нормы ключевых SKU → полоса + прогноз закупки. Живой отель позже.",
    forecastNoGuestNights: "Нет гостевых ночей за период — добавьте ниже.",
    forecastNormsAllZero: "Все AZN-нормы SKU = 0 — теоретический расчёт будет 0.",
    staffPlanInactiveHint:
      "Неактивный план не попадает в прогноз и экспорт себестоимости — нажмите «Сделать активным».",
    rollupCaption:
      "Гостевые ночи идут в Прогноз (теория). Итого meal = план + руководство + персонал — не гостевые ночи.",
    rollupForecastTotal: "Итого прогноз приёма",
  });
  j.admin.buffet.chefWarning = {
    ...j.admin.buffet.chefWarning,
    NO_GUEST_NIGHTS: "Нет гостевых ночей за период — теория будет 0.",
    NORMS_ALL_ZERO: "Все нормы ключевых SKU в AZN = 0 — заполните Нормы.",
  };
  if (j.admin.settings) {
    j.admin.settings.buffetCostHint =
      "Живой HYBRID: Себестоимость собирает POS продажи + нулевую цену + персонал net + теорию Прогноза, затем Finance для FOOD residual. Override по точке опционален.";
  }
});

patch("en.json", (j) => {
  Object.assign(j.admin.buffet, {
    costRunLoadFailed: "Could not load calculation",
    costRunFinanceLink: "Open Finance HYBRID food-cost report",
    forecastNoGuestNights: "No guest-nights in this range — add below.",
    forecastNormsAllZero: "All SKU AZN norms are 0 — theoretical will be 0.",
  });
  j.admin.buffet.chefWarning = {
    ...j.admin.buffet.chefWarning,
    NO_GUEST_NIGHTS: "No guest-nights for the period — theoretical will be 0.",
    NORMS_ALL_ZERO: "All key SKU AZN norms are 0 — fill Norms.",
  };
});
