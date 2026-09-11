const fs = require("fs");
const files = [
  "d:/My Projects/era-ecosystem/era-clinic/messages/en.json",
  "d:/My Projects/era-ecosystem/era-clinic/messages/az.json",
  "d:/My Projects/era-ecosystem/era-clinic/messages/ru.json",
];

const patches = {
  en: {
    sanatorium: {
      replaceProcedure: "Replace",
      replaceFrom: "From",
      replaceTo: "To",
      replaceSubmit: "Replace",
      qtyDown: "−1",
      checkedInLocked: "Checked in",
      softWarn: "Note",
      note: "Note",
      extrasEmpty: "No additional procedures.",
      packageEmptyLeft: "No package lines.",
      packageEmptyRight: "Nothing assigned yet.",
      addPaidSameDay: "Add paid (same-day)",
      addPaidSameDayHint:
        "Reception manual slot. If the guest already has 3 package procedures today, confirm to charge folio (does not burn package quota).",
      sameDayFourthWarn:
        "Already 3 package procedures today. Confirm to post as paid folio (not package quota).",
      confirmPaidFolio: "Confirm paid folio",
      paidSameDayAdded: "Paid same-day procedure added",
    },
    patientCard: {
      replaceProcedure: "Replace",
      replaceFrom: "From",
      replaceTo: "To",
      replaceSubmit: "Replace",
      qtyDown: "−1",
      checkedInLocked: "Checked in",
      softWarn: "Note",
      note: "Note",
      extrasEmpty: "No additional procedures.",
      packageEmptyLeft: "No package lines.",
      packageEmptyRight: "Nothing assigned yet.",
    },
    extraTickets: {
      receiptRef: "Payment receipt / cheque #",
      receiptPlaceholder: "Required before Pay",
      receiptRequired: "Enter payment receipt / cheque reference",
      selectedTotal: "Selected total",
    },
  },
  az: {
    sanatorium: {
      replaceProcedure: "Əvəz et",
      replaceFrom: "Hansıdan",
      replaceTo: "Hansına",
      replaceSubmit: "Əvəz et",
      qtyDown: "−1",
      checkedInLocked: "Check-in olunub",
      softWarn: "Qeyd",
      note: "Qeyd",
      extrasEmpty: "Əlavə prosedur yoxdur.",
      packageEmptyLeft: "Paket sətri yoxdur.",
      packageEmptyRight: "Hələ təyin edilməyib.",
      addPaidSameDay: "Ödənişli əlavə et (eyni gün)",
      addPaidSameDayHint:
        "Resepsiya əl ilə. Əgər bu gün artıq 3 paket proseduru varsa, folio ödənişi təsdiqləyin (paket kvotasını yandırmır).",
      sameDayFourthWarn:
        "Bu gün artıq 3 paket proseduru var. Ödənişli folio kimi təsdiqləyin (paket kvotası deyil).",
      confirmPaidFolio: "Ödənişli folio təsdiq",
      paidSameDayAdded: "Ödənişli eyni-gün proseduru əlavə edildi",
    },
    patientCard: {
      replaceProcedure: "Əvəz et",
      replaceFrom: "Hansıdan",
      replaceTo: "Hansına",
      replaceSubmit: "Əvəz et",
      qtyDown: "−1",
      checkedInLocked: "Check-in olunub",
      softWarn: "Qeyd",
      note: "Qeyd",
      extrasEmpty: "Əlavə prosedur yoxdur.",
      packageEmptyLeft: "Paket sətri yoxdur.",
      packageEmptyRight: "Hələ təyin edilməyib.",
    },
    extraTickets: {
      receiptRef: "Ödəniş qəbzi / çek #",
      receiptPlaceholder: "Ödənişdən əvvəl tələb olunur",
      receiptRequired: "Ödəniş qəbzi / çek nömrəsini daxil edin",
      selectedTotal: "Seçilmiş cəm",
    },
  },
  ru: {
    sanatorium: {
      replaceProcedure: "Заменить",
      replaceFrom: "Откуда",
      replaceTo: "Куда",
      replaceSubmit: "Заменить",
      qtyDown: "−1",
      checkedInLocked: "Check-in",
      softWarn: "Примечание",
      note: "Заметка",
      extrasEmpty: "Нет дополнительных процедур.",
      packageEmptyLeft: "Нет строк пакета.",
      packageEmptyRight: "Пока ничего не назначено.",
      addPaidSameDay: "Добавить платно (тот же день)",
      addPaidSameDayHint:
        "Ручной слот ресепшена. Если уже 3 пакетные процедуры сегодня — подтвердите folio (квота пакета не сгорает).",
      sameDayFourthWarn:
        "Уже 3 пакетные процедуры сегодня. Подтвердите платную folio (не квота пакета).",
      confirmPaidFolio: "Подтвердить платную folio",
      paidSameDayAdded: "Платная процедура на этот день добавлена",
    },
    patientCard: {
      replaceProcedure: "Заменить",
      replaceFrom: "Откуда",
      replaceTo: "Куда",
      replaceSubmit: "Заменить",
      qtyDown: "−1",
      checkedInLocked: "Check-in",
      softWarn: "Примечание",
      note: "Заметка",
      extrasEmpty: "Нет дополнительных процедур.",
      packageEmptyLeft: "Нет строк пакета.",
      packageEmptyRight: "Пока ничего не назначено.",
    },
    extraTickets: {
      receiptRef: "Квитанция / чек #",
      receiptPlaceholder: "Обязательно перед Pay",
      receiptRequired: "Укажите номер квитанции / чека",
      selectedTotal: "Итого по выбранным",
    },
  },
};

for (const f of files) {
  const lang = f.includes("az.json") ? "az" : f.includes("ru.json") ? "ru" : "en";
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const p = patches[lang];
  for (const [section, keys] of Object.entries(p)) {
    if (!j[section]) j[section] = {};
    Object.assign(j[section], keys);
  }
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("patched", lang);
}
