import fs from 'fs';
import path from 'path';

const dir = path.resolve('messages');
const extra = {
  en: {
    roomPayer: 'Who pays the room',
    roomPayerGuest: 'Guest',
    roomPayerAgency: 'Agency',
    roomPayerCompany: 'Company',
    commissionBasis: 'Gross / net',
    basisGross: 'Gross',
    basisNet: 'Net',
    roomPaidByGuest: 'Room is paid by the guest',
    roomPaidByAgency: 'Room is paid by the agency ({name})',
    roomPaidByCompany: 'Room is paid by the company ({name})',
    basisGrossWithPct: 'gross, commission {pct}%',
    basisGrossOnly: 'gross',
    basisNetOnly: 'net',
    basisNetWithContract: 'net, contract {contract}',
    contractRequiredMark: 'required',
    contractRequiredHint: 'Choose a contract. The room is paid by the agency or the company.',
    contractCreateHint: 'Create a contract in B2B contracts.',
    contractRequiredToast: 'Choose a contract. The room is paid by the agency or the company.',
    rateNotContractToast: 'This rate is not the contract rate.',
    agencyRemovedToast: 'Agency removed. Commission for this stay has stopped.',
    agencyRemovedConfirm: 'Commission for this stay will stop. Continue?',
    agencyHasLinesToast:
      'This agency already has room charges. Move them, or leave the agency on the stay.',
    companyHasLinesToast:
      'This company already has room charges. Move them, or leave the company on the stay.',
    changeRoomPayerTitle: 'Change who pays the room',
    changeRoomPayerBody: 'From {date}: {summary}',
    nextNightsOnly: 'Next nights only',
    alsoMovePosted: 'Also move nights already posted',
    moveReasonLabel: 'Reason',
    moveReasonRequired: 'Enter a reason to move posted nights.',
    commercialNoteTemplate:
      'From {date} the room is paid by {payer}, {basis} (was: {wasPayer}, {wasBasis}). {posted}',
    commercialNoteNotMoved: 'Nights already posted were not recalculated.',
    commercialNoteMoved: 'Posted room nights were moved to the new payer.',
    roomPaymentFollowsPayer: 'Payment for the room goes to {name}.',
  },
  az: {
    roomPayer: 'Otağı kim ödəyir',
    roomPayerGuest: 'Qonaq',
    roomPayerAgency: 'Agentlik',
    roomPayerCompany: 'Şirkət',
    commissionBasis: 'Gross / net',
    basisGross: 'Gross',
    basisNet: 'Net',
    roomPaidByGuest: 'Otağı qonaq ödəyir',
    roomPaidByAgency: 'Otağı agentlik ödəyir ({name})',
    roomPaidByCompany: 'Otağı şirkət ödəyir ({name})',
    basisGrossWithPct: 'gross, komissiya {pct}%',
    basisGrossOnly: 'gross',
    basisNetOnly: 'net',
    basisNetWithContract: 'net, müqavilə {contract}',
    contractRequiredMark: 'məcburi',
    contractRequiredHint: 'Müqavilə seçin. Otağı agentlik və ya şirkət ödəyir.',
    contractCreateHint: 'B2B müqavilələrində müqavilə yaradın.',
    contractRequiredToast: 'Müqavilə seçin. Otağı agentlik və ya şirkət ödəyir.',
    rateNotContractToast: 'Bu tarif müqavilə tarifindən fərqlidir.',
    agencyRemovedToast: 'Agentlik silindi. Bu rezervasiya üçün komissiya dayanıb.',
    agencyRemovedConfirm: 'Bu rezervasiya üçün komissiya dayanacaq. Davam?',
    agencyHasLinesToast:
      'Bu agentlikdə artıq otaq yazıları var. Köçürün və ya agentliyi saxlayın.',
    companyHasLinesToast:
      'Bu şirkətdə artıq otaq yazıları var. Köçürün və ya şirkəti saxlayın.',
    changeRoomPayerTitle: 'Otaq ödəyicisini dəyiş',
    changeRoomPayerBody: '{date}-dən: {summary}',
    nextNightsOnly: 'Yalnız növbəti gecələr',
    alsoMovePosted: 'Artıq yazılmış gecələri də köçür',
    moveReasonLabel: 'Səbəb',
    moveReasonRequired: 'Köçürmə üçün səbəb yazın.',
    commercialNoteTemplate:
      '{date}-dən otağı {payer} ödəyir, {basis} (əvvəl: {wasPayer}, {wasBasis}). {posted}',
    commercialNoteNotMoved: 'Artıq yazılmış gecələr yenidən hesablanmayıb.',
    commercialNoteMoved: 'Yazılmış otaq gecələri yeni ödəyiciyə köçürüldü.',
    roomPaymentFollowsPayer: 'Otaq ödənişi → {name}.',
  },
  ru: {
    roomPayer: 'Кто платит номер',
    roomPayerGuest: 'Гость',
    roomPayerAgency: 'Агентство',
    roomPayerCompany: 'Компания',
    commissionBasis: 'Гросс / нетто',
    basisGross: 'Гросс',
    basisNet: 'Нетто',
    roomPaidByGuest: 'Номер платит гость',
    roomPaidByAgency: 'Номер платит агентство ({name})',
    roomPaidByCompany: 'Номер платит компания ({name})',
    basisGrossWithPct: 'гросс, комиссия {pct}%',
    basisGrossOnly: 'гросс',
    basisNetOnly: 'нетто',
    basisNetWithContract: 'нетто, договор {contract}',
    contractRequiredMark: 'обязателен',
    contractRequiredHint: 'Выберите договор. Номер платит агентство или компания.',
    contractCreateHint: 'Создайте договор в B2B-контрактах.',
    contractRequiredToast: 'Выберите договор. Номер платит агентство или компания.',
    rateNotContractToast: 'Этот тариф не совпадает с тарифом договора.',
    agencyRemovedToast: 'Агентство снято. Комиссия по этой брони остановлена.',
    agencyRemovedConfirm: 'Комиссия по этой брони остановится. Продолжить?',
    agencyHasLinesToast:
      'У этого агентства уже есть списания за номер. Перенесите их или оставьте агентство.',
    companyHasLinesToast:
      'У этой компании уже есть списания за номер. Перенесите их или оставьте компанию.',
    changeRoomPayerTitle: 'Смена плательщика номера',
    changeRoomPayerBody: 'С {date}: {summary}',
    nextNightsOnly: 'Только следующие ночи',
    alsoMovePosted: 'Также перенести уже начисленные ночи',
    moveReasonLabel: 'Причина',
    moveReasonRequired: 'Укажите причину переноса начисленных ночей.',
    commercialNoteTemplate:
      'С {date} номер платит {payer}, {basis} (было: {wasPayer}, {wasBasis}). {posted}',
    commercialNoteNotMoved: 'Уже начисленные ночи не пересчитаны.',
    commercialNoteMoved: 'Начисленные ночи за номер перенесены новому плательщику.',
    roomPaymentFollowsPayer: 'Оплата за номер → {name}.',
  },
};

for (const loc of ['en', 'az', 'ru']) {
  const file = path.join(dir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.reservationCard = { ...data.reservationCard, ...extra[loc] };
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('patched', loc);
}
