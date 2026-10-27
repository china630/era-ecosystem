import fs from 'fs';

const patches = {
  en: {
    rosterTitle: 'Tour roster',
    notSet: 'Not set',
    vehicleMissing: 'No vehicle',
    vehicleMissingHint:
      'Assign a vehicle before marking departed or printing a useful manifest.',
    vehicleRequiredForDepart: 'Assign a vehicle before marking departed',
    boardSelected: 'Board selected',
    boardSelectedCount: 'Selected to board: {count}',
    selectToBoard: 'Select at least one reserved guest to board',
    boardingClosedMeta: 'Boarding closed — boarded {boarded}, dropped {dropped}',
    noBankTerminal: 'No bank terminal configured — pick Cash or add a BANK_POS device',
    boardedYes: 'Yes',
    boardedNo: 'No',
  },
  az: {
    rosterTitle: 'Tur siyahısı',
    notSet: 'Təyin edilməyib',
    vehicleMissing: 'Nəqliyyat yoxdur',
    vehicleMissingHint:
      'Yola düşməzdən və ya manifesto çap etməzdən əvvəl nəqliyyat təyin edin.',
    vehicleRequiredForDepart: 'Yola düşmüş kimi qeyd etməzdən əvvəl nəqliyyat təyin edin',
    boardSelected: 'Seçilənləri mindir',
    boardSelectedCount: 'Mindirmə üçün seçilib: {count}',
    selectToBoard: 'Ən azı bir rezerv qonaq seçin',
    boardingClosedMeta: 'Mindirmə bağlandı — mindirildi {boarded}, silindi {dropped}',
    noBankTerminal: 'Bank terminalı yoxdur — Nağd seçin və ya BANK_POS əlavə edin',
    boardedYes: 'Bəli',
    boardedNo: 'Xeyr',
  },
  ru: {
    rosterTitle: 'Список тура',
    notSet: 'Не указано',
    vehicleMissing: 'Нет транспорта',
    vehicleMissingHint: 'Назначьте транспорт перед отправлением или печатью манифеста.',
    vehicleRequiredForDepart: 'Назначьте транспорт перед отметкой «Уехал»',
    boardSelected: 'Посадить выбранных',
    boardSelectedCount: 'Выбрано к посадке: {count}',
    selectToBoard: 'Выберите хотя бы одного гостя со статусом Reserved',
    boardingClosedMeta: 'Посадка закрыта — посажено {boarded}, снято {dropped}',
    noBankTerminal: 'Нет банковского терминала — выберите наличные или добавьте BANK_POS',
    boardedYes: 'Да',
    boardedNo: 'Нет',
  },
};

for (const loc of Object.keys(patches)) {
  const p = `era-hotel-pms/messages/${loc}.json`;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(j.tours, patches[loc]);
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, 'utf8');
  console.log('patched', p);
}
