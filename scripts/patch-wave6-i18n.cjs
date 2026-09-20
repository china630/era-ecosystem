const fs = require("fs");

function patch(file, navVal, block) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes('"wfAttendance"')) {
    s = s.replace(
      '"wfGroup":',
      `"wfAttendance": ${JSON.stringify(navVal)},\n    "wfGroup":`,
    );
  }
  if (!s.includes('"workforceAttendance"')) {
    const marker = '"workforceRoster"';
    const idx = s.indexOf(marker);
    if (idx < 0) throw new Error("no roster in " + file);
    s =
      s.slice(0, idx) +
      `"workforceAttendance": ${JSON.stringify(block, null, 2)},\n  ` +
      s.slice(idx);
  }
  if (!s.includes('"sourceFaceid"')) {
    s = s.replace(
      '"cellApproved":',
      `"sourceFaceid": ${JSON.stringify(block.sourceFaceid)},\n    "sourceOps": ${JSON.stringify(block.sourceOps)},\n    "sourceRoster": ${JSON.stringify(block.sourceRoster)},\n    "cellApproved":`,
    );
  }
  fs.writeFileSync(file, s, "utf8");
  console.log("patched", file);
}

const en = {
  title: "Attendance (FaceID)",
  subtitle:
    "Devices, personRef mapping, UNMAPPED queue, and rebuild DRAFT timesheet from punches.",
  devicesTitle: "Devices",
  identitiesTitle: "Identity map",
  punchesTitle: "Punch queue",
  rebuildTitle: "Rebuild DRAFT timesheet",
  rebuildHint:
    "Pairs IN→OUT (Asia/Baku). Does not overwrite APPROVED cells or absence locks.",
  csvTitle: "CSV fallback",
  csvHint: "Header: occurredAt,direction,personRef[,externalId,placeCode]",
  addDevice: "Add device",
  addIdentity: "Map personRef",
  revoke: "Revoke",
  tokenOnce: "Copy this token now — it will not be shown again.",
  colName: "Name",
  colPlace: "Place",
  colStatus: "Status",
  colHmac: "HMAC",
  colPersonRef: "personRef",
  colEmployment: "Employment",
  colWhen: "When",
  colDirection: "Dir",
  punchFilter: "Status filter",
  placeMismatch: "place mismatch",
  hmacOn: "Required",
  hmacOff: "Off",
  requireHmac: "Require HMAC body signature",
  emptyDevices: "No devices yet.",
  emptyPunches: "No punches in this filter.",
  from: "From",
  to: "To",
  rebuild: "Rebuild",
  rebuildOk: "Paired {pairs}; cells {cells}; open {open}; skipped {skipped}.",
  rebuildError: "Rebuild failed.",
  csvDevice: "Device",
  csvImport: "Import CSV",
  csvOk: "Accepted {accepted}, rejected {rejected}, duplicates {duplicates}.",
  csvError: "CSV import failed.",
  loadError: "Failed to load attendance data.",
  saveError: "Save failed.",
  sourceFaceid: "FaceID",
  sourceOps: "Manual",
  sourceRoster: "Plan",
};

const ru = {
  ...en,
  title: "Явка (FaceID)",
  subtitle:
    "Устройства, маппинг personRef, очередь UNMAPPED и заполнение DRAFT-табеля из проходов.",
  devicesTitle: "Устройства",
  identitiesTitle: "Маппинг personRef",
  punchesTitle: "Очередь проходов",
  rebuildTitle: "Пересбор DRAFT-табеля",
  rebuildHint:
    "Пары IN→OUT (Asia/Baku). Не затирает APPROVED и absence lock.",
  csvTitle: "CSV fallback",
  addDevice: "Добавить устройство",
  addIdentity: "Сопоставить personRef",
  revoke: "Отозвать",
  tokenOnce: "Скопируйте токен сейчас — он больше не покажется.",
  placeMismatch: "чужой объект",
  requireHmac: "Требовать HMAC подпись тела",
  emptyDevices: "Нет устройств.",
  emptyPunches: "Нет проходов в этом фильтре.",
  rebuild: "Пересобрать",
  rebuildOk: "Пар {pairs}; ячеек {cells}; открытых {open}; пропущено {skipped}.",
  rebuildError: "Ошибка пересбора.",
  csvImport: "Импорт CSV",
  csvOk: "Принято {accepted}, отклонено {rejected}, дубли {duplicates}.",
  csvError: "Ошибка CSV.",
  loadError: "Не удалось загрузить.",
  saveError: "Ошибка сохранения.",
  sourceFaceid: "FaceID",
  sourceOps: "Вручную",
  sourceRoster: "План",
};

const az = {
  ...en,
  title: "Davamiyyət (FaceID)",
  subtitle:
    "Cihazlar, personRef map, UNMAPPED növbə və punch-lardan DRAFT tabel.",
  devicesTitle: "Cihazlar",
  identitiesTitle: "personRef xəritəsi",
  punchesTitle: "Punch növbəsi",
  rebuildTitle: "DRAFT tabel yenidən qur",
  rebuildHint:
    "IN→OUT cütləri (Asia/Baku). APPROVED və absence lock toxunulmur.",
  csvTitle: "CSV fallback",
  addDevice: "Cihaz əlavə et",
  addIdentity: "personRef bağla",
  revoke: "Ləğv et",
  tokenOnce: "Tokeni indi kopyalayın — bir daha göstərilməyəcək.",
  placeMismatch: "obyekt uyğunsuzluğu",
  requireHmac: "HMAC imza tələb et",
  emptyDevices: "Cihaz yoxdur.",
  emptyPunches: "Bu filtrdə punch yoxdur.",
  rebuild: "Yenidən qur",
  rebuildOk: "Cüt {pairs}; xana {cells}; açıq {open}; keçildi {skipped}.",
  rebuildError: "Yenidən qurma alınmadı.",
  csvImport: "CSV idxal",
  csvOk: "Qəbul {accepted}, rədd {rejected}, dublikat {duplicates}.",
  csvError: "CSV xətası.",
  loadError: "Yüklənmədi.",
  saveError: "Saxlama xətası.",
  sourceFaceid: "FaceID",
  sourceOps: "Əl ilə",
  sourceRoster: "Plan",
};

patch("era-orchestrator/apps/web/messages/en.json", "Attendance", en);
patch("era-orchestrator/apps/web/messages/ru.json", "Явка", ru);
patch("era-orchestrator/apps/web/messages/az.json", "Davamiyyət", az);
