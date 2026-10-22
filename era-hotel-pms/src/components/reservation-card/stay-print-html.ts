import { escapePrintHtml } from '@/lib/print-window';

export type StayPrintKind = 'registration' | 'proforma' | 'confirmation';

export type StayPrintHotel = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

export type StayPrintNight = {
  date: string;
  roomType: string;
  board: string;
  adults: number;
  children: number;
  infants: number;
  price: number;
};

export type StayPrintModel = {
  kind: StayPrintKind;
  title: string;
  hotel: StayPrintHotel;
  resNo: string;
  guestName: string;
  agency: string;
  voucher: string;
  rate: string;
  arrival: string;
  departure: string;
  roomType: string;
  roomNumber: string;
  board: string;
  adults: number;
  children: number;
  infants: number;
  nights: number;
  nightPrice: number;
  total: number;
  deposit: number;
  balance: number;
  phone: string;
  email: string;
  documentNo: string;
  nationality: string;
  birthDate: string;
  sex: string;
  currency: string;
  notes: string;
  nightsGrid: StayPrintNight[];
  labels: {
    resNo: string;
    agency: string;
    voucher: string;
    rate: string;
    arrival: string;
    departure: string;
    room: string;
    board: string;
    pax: string;
    guest: string;
    phone: string;
    email: string;
    document: string;
    nationality: string;
    birth: string;
    sex: string;
    signature: string;
    nightPrice: string;
    nights: string;
    total: string;
    deposit: string;
    balance: string;
    date: string;
    roomType: string;
    price: string;
    adults: string;
    children: string;
    infants: string;
    dear: string;
    confirmed: string;
    contact: string;
    notes: string;
    legal: string[];
  };
};

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

function row(label: string, value: string): string {
  return `<tr><th>${escapePrintHtml(label)}</th><td>${escapePrintHtml(value || '—')}</td></tr>`;
}

function shell(title: string, hotel: StayPrintHotel, body: string): string {
  const contact = [hotel.address, hotel.phone, hotel.email, hotel.website].filter(Boolean).join(' · ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapePrintHtml(title)}</title>
<style>
  body { font-family: "Segoe UI", sans-serif; color: #1a1a1a; margin: 24px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 6px; }
  .hotel { font-size: 14px; font-weight: 700; }
  .contact { color: #555; margin: 0 0 12px; }
  table.facts { width: 100%; border-collapse: collapse; }
  table.facts th { text-align: left; width: 34%; font-weight: 600; padding: 3px 8px 3px 0; vertical-align: top; }
  table.facts td { padding: 3px 0; }
  table.grid { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.grid th, table.grid td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  table.grid th { background: #f4f5f7; }
  .right { text-align: right; }
  .sign { margin-top: 28px; }
  .legal { margin-top: 16px; font-size: 11px; line-height: 1.45; }
  .legal p { margin: 0 0 6px; }
</style></head><body>
<p class="hotel">${escapePrintHtml(hotel.name || title)}</p>
<p class="contact">${escapePrintHtml(contact)}</p>
<h1>${escapePrintHtml(title)}</h1>
${body}
</body></html>`;
}

function facts(model: StayPrintModel): string {
  const L = model.labels;
  const pax = `${model.adults}+${model.children}+${model.infants}`;
  const room = [model.roomType, model.roomNumber].filter(Boolean).join(' / ');
  return `<table class="facts">
    ${row(L.resNo, model.resNo)}
    ${row(L.guest, model.guestName)}
    ${row(L.agency, model.agency)}
    ${row(L.arrival, model.arrival)}
    ${row(L.departure, model.departure)}
    ${row(L.room, room)}
    ${row(L.board, model.board)}
    ${row(L.pax, pax)}
    ${row(L.voucher, model.voucher)}
    ${row(L.rate, model.rate)}
    ${row(L.nights, String(model.nights))}
    ${row(L.nightPrice, money(model.nightPrice, model.currency))}
    ${row(L.total, money(model.total, model.currency))}
    ${row(L.deposit, money(model.deposit, model.currency))}
    ${row(L.balance, money(model.balance, model.currency))}
  </table>`;
}

export function buildStayFormHtml(model: StayPrintModel): string {
  const L = model.labels;
  if (model.kind === 'proforma') {
    const lines = model.nightsGrid
      .map(
        (night) =>
          `<tr><td>${escapePrintHtml(night.date)}</td><td>${escapePrintHtml(night.roomType)}</td><td>${escapePrintHtml(night.board)}</td><td class="right">${night.adults}</td><td class="right">${night.children}</td><td class="right">${night.infants}</td><td class="right">${night.price.toFixed(2)}</td></tr>`,
      )
      .join('');
    const sum = model.nightsGrid.reduce((acc, night) => acc + night.price, 0);
    return shell(
      model.title,
      model.hotel,
      `${facts(model)}
      <h2>${escapePrintHtml(L.date)}</h2>
      <table class="grid"><thead><tr>
        <th>${escapePrintHtml(L.date)}</th>
        <th>${escapePrintHtml(L.roomType)}</th>
        <th>${escapePrintHtml(L.board)}</th>
        <th>${escapePrintHtml(L.adults)}</th>
        <th>${escapePrintHtml(L.children)}</th>
        <th>${escapePrintHtml(L.infants)}</th>
        <th>${escapePrintHtml(L.price)}</th>
      </tr></thead><tbody>${lines}
      <tr><td colspan="6"><strong>${escapePrintHtml(L.total)}</strong></td><td class="right"><strong>${sum.toFixed(2)}</strong></td></tr>
      </tbody></table>`,
    );
  }

  if (model.kind === 'confirmation') {
    return shell(
      model.title,
      model.hotel,
      `<p>${escapePrintHtml(L.dear)} ${escapePrintHtml(model.guestName)}</p>
      <p>${escapePrintHtml(L.confirmed)}</p>
      ${facts(model)}
      ${model.notes ? `<h2>${escapePrintHtml(L.notes)}</h2><p>${escapePrintHtml(model.notes)}</p>` : ''}
      <p>${escapePrintHtml(L.contact)}</p>`,
    );
  }

  const legal = L.legal.map((line) => `<p>${escapePrintHtml(line)}</p>`).join('');
  return shell(
    model.title,
    model.hotel,
    `${facts(model)}
    <h2>${escapePrintHtml(L.guest)}</h2>
    <table class="facts">
      ${row(L.phone, model.phone)}
      ${row(L.email, model.email)}
      ${row(L.document, model.documentNo)}
      ${row(L.nationality, model.nationality)}
      ${row(L.birth, model.birthDate)}
      ${row(L.sex, model.sex)}
    </table>
    <div class="legal">${legal}</div>
    <p class="sign">${escapePrintHtml(L.signature)} ____________________</p>`,
  );
}
