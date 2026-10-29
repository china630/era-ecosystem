/**
 * WP2 chef dictionary — patch az/ru/en buffet + nav strings (UTF-8).
 * Run: node scripts/ops/patch-chef-i18n-wp2.mjs
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
  Object.assign(j.nav, {
    import: "İdxal",
    buffetTemplates: "Şablonlar",
    buffetManagement: "Rəhbərlik",
    buffetCostRun: "Maya dəyəri",
  });
  Object.assign(j.admin.buffet, {
    outlet: "Nöqtə",
    plansHierarchyHint: "Əsas: həftəni şablondan yarat. Əlavə: bir plan.",
    templatesChromeHint: "Şablonlar siyahısı — yenisini modalda yaradın.",
    templatesListTitle: "Həftə şablonları",
    templateActiveCol: "Aktiv",
    templateSlotsCol: "Slotlar",
    templateActiveYes: "aktiv",
    newTemplate: "Yeni şablon",
    makeActive: "Aktiv et",
    defaultTemplateName: "Həftə şablonu",
    spawnWeek: "Həftəni yarat",
    newPlan: "Bir plan",
    costRunRefresh: "Hesabı yenilə",
    costRunBuckets: "Göstəricilər",
    costRunStaffOverrideShow: "İşçi əvəzləməsi…",
    costRunStaffOverrideHide: "Əvəzləməni gizlət",
    costRunStaffGrossOverride: "İşçi əvəzləməsi (AZN)",
    costRunTheoBlockedTitle: "Əvvəl doldur",
    costRunTheoBlockedBody:
      "Maya dəyərinə etibar etməzdən əvvəl Proqnozda qonaq gecələri və Normalarda SKU məbləğlərini doldurun.",
    costRunGoForecast: "Proqnozu aç",
    costRunGoNorms: "Normaları aç",
    costRunGuestNights: "Qonaq gecələri",
    costRunComp: "Sıfır qiymət / COMP",
    costRunSale: "POS satış mayası",
    costRunTheoretical: "Nəzəri (Proqnoz)",
    costRunEmpty: "Hesabat yoxdur — nöqtə və tarixləri seçin.",
    forecastSyncHotel: "Oteldən götür",
    forecastHotelUnavailable: "Otel bağlı deyil — gecələri əl ilə daxil edin.",
    forecastHotelSyncFailed: "Oteldən götürmək alınmadı",
    forecastSaveNorms: "Saxla",
    forecastOverrideTotal: "Əl ilə cəm",
    forecastManualHonesty:
      "Qonaq gecələri əl ilə (və ya dövr cəmi) — canlı otel axını sonra.",
    forecastGuestNights: "Qonaq gecələri",
    normsHint: "SKU normaları və yük zolaqları.",
    normsHelp:
      "Cəmi qonaq gecəsi aralığa düşəndə zolaq (az/orta/yüksək yük) → nəzəri satınalma / Maya dəyəri. Min/max = gecə hədləri.",
    eatersSyncUnavailable: "HR bağlı deyil — əl ilə əlavə et.",
    eatersEmptyHonesty:
      "Siyahı boşdur. HR sinkronu işləmirsə — əl ilə ad əlavə edin.",
    eatersRoster: "Bufet yeyənlər",
    eatersSyncHr: "HR-dən götür",
    tabCostRun: "Maya dəyəri",
    kindFilter: "Növ",
  });
});

patch("ru.json", (j) => {
  Object.assign(j.nav, {
    import: "Импорт",
    buffetTemplates: "Шаблоны",
    buffetManagement: "Руководство",
    buffetCostRun: "Себестоимость",
  });
  Object.assign(j.admin.buffet, {
    outlet: "Точка",
    plansHierarchyHint: "Главное: создать неделю из шаблона. Дополнительно: один план.",
    templatesChromeHint: "Список шаблонов — новый создаётся в модалке.",
    templatesListTitle: "Недельные шаблоны",
    templateActiveCol: "Активен",
    templateSlotsCol: "Слоты",
    templateActiveYes: "активен",
    newTemplate: "Новый шаблон",
    makeActive: "Сделать активным",
    defaultTemplateName: "Недельный шаблон",
    spawnWeek: "Создать неделю",
    newPlan: "Один план",
    costRunRefresh: "Обновить расчёт",
    costRunBuckets: "Показатели",
    costRunStaffOverrideShow: "Замена персонала…",
    costRunStaffOverrideHide: "Скрыть замену",
    costRunStaffGrossOverride: "Замена персонала (AZN)",
    costRunTheoBlockedTitle: "Сначала заполните",
    costRunTheoBlockedBody:
      "Перед расчётом заполните гостевые ночи в Прогнозе и нормы SKU в Нормах.",
    costRunGoForecast: "Открыть Прогноз",
    costRunGoNorms: "Открыть Нормы",
    costRunGuestNights: "Гостевые ночи",
    costRunComp: "Нулевая цена / COMP",
    costRunSale: "Себестоимость POS-продаж",
    costRunTheoretical: "Теория (Прогноз)",
    costRunEmpty: "Нет расчёта — выберите точку и даты.",
    forecastSyncHotel: "Взять из отеля",
    forecastHotelUnavailable: "Отель недоступен — введите ночи вручную.",
    forecastHotelSyncFailed: "Не удалось взять из отеля",
    forecastSaveNorms: "Сохранить",
    forecastOverrideTotal: "Ручная сумма",
    forecastManualHonesty:
      "Гостевые ночи вручную (или сумма периода) — живой отель позже.",
    forecastGuestNights: "Гостевые ночи",
    normsHint: "Нормы SKU и полосы нагрузки.",
    normsHelp:
      "Когда сумма гостевых ночей попадает в диапазон, выбирается полоса (низ/сред/высок) → теория закупки / Себестоимость. Min/max = пороги ночей.",
    eatersSyncUnavailable: "HR недоступен — добавьте вручную.",
    eatersEmptyHonesty:
      "Список пуст. Если HR не тянется — добавьте имя вручную.",
    eatersRoster: "Едоки буфета",
    eatersSyncHr: "Взять из HR",
    tabCostRun: "Себестоимость",
    kindFilter: "Тип",
    template: "Шаблон",
  });
});

patch("en.json", (j) => {
  Object.assign(j.nav, {
    import: "Import",
    buffetCostRun: "Food cost",
  });
  Object.assign(j.admin.buffet, {
    outlet: "Outlet",
    plansHierarchyHint: "Primary: spawn the week from a template. Secondary: one plan.",
    templatesChromeHint: "Template list — create new in a modal.",
    templatesListTitle: "Week templates",
    templateActiveCol: "Active",
    templateSlotsCol: "Slots",
    templateActiveYes: "active",
    costRunRefresh: "Refresh calculation",
    costRunBuckets: "Indicators",
    costRunStaffOverrideShow: "Staff override…",
    costRunStaffOverrideHide: "Hide staff override",
    costRunTheoBlockedTitle: "Fill these first",
    costRunTheoBlockedBody:
      "Add guest-nights on Forecast and SKU AZN norms on Norms before trusting food cost.",
    costRunGoForecast: "Open Forecast",
    costRunGoNorms: "Open Norms",
    forecastSyncHotel: "Pull from hotel",
    forecastHotelUnavailable: "Hotel unavailable — enter nights manually.",
    forecastSaveNorms: "Save",
    forecastOverrideTotal: "Manual total",
    normsHint: "SKU norms and load bands.",
    normsHelp:
      "When total guest-nights fall in a band (low/mid/high), theoretical purchase / food cost uses that band. Min/max = night thresholds.",
    eatersSyncUnavailable: "HR unavailable — add manually.",
    eatersEmptyHonesty: "List is empty. If HR sync fails — add a name manually.",
    eatersRoster: "Buffet eaters",
    tabCostRun: "Food cost",
    spawnWeek: "Create week",
    newPlan: "One plan",
  });
});
