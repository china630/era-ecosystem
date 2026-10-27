import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../messages');

const folioKeys = {
  folioDate: { en: 'Date', az: 'Tarix', ru: 'Дата' },
  folioTime: { en: 'Time', az: 'Vaxt', ru: 'Время' },
  paymentBadge: { en: 'Pay', az: 'Ödəniş', ru: 'Оплата' },
  refundBadge: { en: 'Refund', az: 'Qaytarma', ru: 'Возврат' },
  adjustBadge: { en: 'Adj', az: 'Düzəliş', ru: 'Корр.' },
  cityLedgerBadge: { en: 'CL', az: 'CL', ru: 'CL' },
  companyOwes: { en: "Company's debt", az: 'Şirkət borcu', ru: 'Долг компании' },
  agencyOwes: { en: "Agency's debt", az: 'Agentlik borcu', ru: 'Долг агентства' },
  payOpenDebtHint: {
    en: 'Open debt articles are listed first. Pay those before posting a credit.',
    az: 'Açıq borc maddələri əvvəl gəlir. Kreditdən əvvəl onları ödəyin.',
    ru: 'Статьи с открытым долгом сверху. Сначала закройте их, потом кредит.',
  },
  allowCreditWhileDebtHint: {
    en: 'Post as credit / prepay even though other articles still owe.',
    az: 'Başqa maddələrdə borc olsa belə kredit / əvvəlcədən ödəniş kimi yaz.',
    ru: 'Записать как кредит / предоплату, хотя по другим статьям ещё есть долг.',
  },
};

const cardKeys = {
  folioDate: folioKeys.folioDate,
  folioTime: folioKeys.folioTime,
  companyOwes: folioKeys.companyOwes,
  agencyOwes: folioKeys.agencyOwes,
  earlyStayCheckoutCompanyDebtHint: {
    en: 'Company folio still owes {amount} AZN — pay or City Ledger before check-out.',
    az: 'Şirkət foliosunda {amount} AZN borc var — çıxışdan əvvəl ödəyin və ya City Ledger.',
    ru: 'На фолио компании долг {amount} AZN — оплатите или City Ledger до выезда.',
  },
  earlyStayCheckoutAgencyDebtHint: {
    en: 'Agency folio still owes {amount} AZN — pay or City Ledger before check-out.',
    az: 'Agentlik foliosunda {amount} AZN borc var — çıxışdan əvvəl ödəyin və ya City Ledger.',
    ru: 'На фолио агентства долг {amount} AZN — оплатите или City Ledger до выезда.',
  },
};

for (const loc of ['en', 'az', 'ru']) {
  const file = path.join(root, `${loc}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(folioKeys)) {
    json.folio[key] = value[loc];
  }
  for (const [key, value] of Object.entries(cardKeys)) {
    json.reservationCard[key] = value[loc];
  }
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log('patched', loc);
}
