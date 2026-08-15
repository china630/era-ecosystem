const fs = require("fs");

function patchJson(file, mutator) {
  let raw = fs.readFileSync(file, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const data = JSON.parse(raw);
  mutator(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  const b = fs.readFileSync(file);
  if (b[0] === 0) throw new Error("UTF-16 in " + file);
  console.log("patched", file, "byte0=", b[0]);
}

const enSan = {
  refresh: "Refresh",
  filterResource: "Filter resource",
  legendFree: "Free",
  legendScheduled: "Scheduled",
  legendCompleted: "Completed",
  legendBlocked: "No-show / blocked",
  staff: "Staff",
  now: "Now",
  dragHint:
    "Board: drag a SCHEDULED bar onto a free (green) cell, or use Move for a filtered free-slot list. Consecutive slots for the same order merge into one bar.",
};

const azSan = {
  refresh: "Yenilə",
  filterResource: "Resurs filtri",
  legendFree: "Boş",
  legendScheduled: "Planlaşdırılıb",
  legendCompleted: "Tamamlanıb",
  legendBlocked: "Gəlməyib / bağlı",
  staff: "Personal",
  now: "İndi",
  dragHint:
    "Lövhə: SCHEDULED zolağı yaşıl xanaya dartın və ya Move ilə boş slot siyahısı. Eyni sifarişin ardıcıl slotları bir zolaqda birləşir.",
};

const ruSan = {
  refresh: "Обновить",
  filterResource: "Фильтр ресурса",
  legendFree: "Свободно",
  legendScheduled: "Запланировано",
  legendCompleted: "Завершено",
  legendBlocked: "Неявка / занято",
  staff: "Персонал",
  now: "Сейчас",
  dragHint:
    "Доска: перетащите полосу SCHEDULED на зелёную ячейку или Move — список свободных слотов. Соседние слоты одного заказа объединяются в полосу.",
};

const enNurse = {
  filterMine: "Mine",
  filterAll: "All",
  mineUnlinked: "Your user is not linked to a practitioner — showing no mine queue. Switch to All or ask admin to link Practitioner.userId.",
};

const azNurse = {
  filterMine: "Mənim",
  filterAll: "Hamısı",
  mineUnlinked:
    "İstifadəçiniz practitionerə bağlı deyil — «Mənim» boşdur. «Hamısı» seçin və ya admindən Practitioner.userId bağlanmasını istəyin.",
};

const ruNurse = {
  filterMine: "Мои",
  filterAll: "Все",
  mineUnlinked:
    "Пользователь не связан с practitioner — очередь «Мои» пуста. Выберите «Все» или попросите админа связать Practitioner.userId.",
};

patchJson("D:/My Projects/era-ecosystem/era-clinic/messages/en.json", (d) => {
  Object.assign(d.sanatoriumResources, enSan);
  Object.assign(d.nurse, enNurse);
});
patchJson("D:/My Projects/era-ecosystem/era-clinic/messages/az.json", (d) => {
  Object.assign(d.sanatoriumResources, azSan);
  Object.assign(d.nurse, azNurse);
});
patchJson("D:/My Projects/era-ecosystem/era-clinic/messages/ru.json", (d) => {
  Object.assign(d.sanatoriumResources, ruSan);
  Object.assign(d.nurse, ruNurse);
});