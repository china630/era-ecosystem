/**
 * One-shot: fill missing HK nav / maids / laundry / rotation / forecast keys (en+az+ru).
 * Run: node era-hotel-pms/scripts/ops/patch-hk-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'messages');

const patches = {
  en: {
    nav: {
      hkStaffGroup: 'HK staff',
      hkMinibarGroup: 'Minibar',
      hkGuestServicesGroup: 'Guest services',
      hkMobile: 'HK mobile',
      closedRoomList: 'Closed rooms',
    },
    maidManagement: {
      pickEmployeeEmpty: 'No unmatched employees for this unit. Change the structural unit or link from HR.',
      orgUnit: 'Structural unit',
      orgUnitAll: 'All units',
      unlink: 'Unlink',
      unlinked: 'Attendant removed from the list',
    },
    housekeeping: {
      laundryWashPrice: 'Wash price',
      laundryWashSum: 'Wash sum',
      laundryIronPrice: 'Iron price',
      laundryIronSum: 'Iron sum',
      laundryTotalRow: 'Total',
      laundryGrandTotal: 'Order total',
      laundryPreviewHint: 'Amounts are a guest preview. The folio is charged only when you press Delivered.',
      laundryCatalogEmpty: 'No laundry catalog items. Seed or add products before intake.',
      laundryOpenCheckoutHint:
        'Clothes are still in laundry. Deliver with a return form, void the open ticket, or wait and keep the guest in-house. Check-out stays open behind this dialog.',
      laundryDeliveredContinueCheckout: 'Laundry delivered. Continuing check-out.',
      laundryVoidedContinueCheckout: 'Laundry ticket voided. Continuing check-out.',
      laundryDeliveredMoreOpen: 'One ticket delivered. Other open laundry tickets remain.',
      stayLinenHint: 'Leave empty to use the hotel policy on Settings → Policies.',
      forecastEmpty: 'No floors in the forecast window. Check rooms and the reservation book.',
      days1: 'Today',
      days30: '30 days',
      discrepancyCreateTitle: 'Record Skip or Sleep',
      discrepancyCreate: 'Save flag',
      mobilePickSelf: 'Select yourself to see rooms on your assigned floors.',
      rotationHint:
        'Attendants must be on duty on the roster, then press Rotate pairs. Default pairs are 2–3, 4–5, 6–7, 8–9, 10–11.',
      rotationSlotEmpty: 'Not assigned',
      rotationSwapNeed: 'Need at least two assigned attendants to swap',
      maidsLink: 'Maid assignment',
      rosterLink: 'HK roster',
      closedEmptyOoo: 'No OOO rooms.',
      closedEmptyOos: 'No OOS rooms.',
      closedRoomsHint: 'OOO leaves inventory. OOS stays in inventory but is not for sale.',
      kindFilter: 'Kind',
      kindAll: 'All kinds',
      laneOpen: 'Open day',
      laneClosed: 'Closed days',
    },
  },
  az: {
    nav: {
      hkStaffGroup: 'HK personal',
      hkMinibarGroup: 'Minibar',
      hkGuestServicesGroup: 'Qonaq xidmətləri',
      hkMobile: 'HK mobil',
      closedRoomList: 'Bağlı otaqlar',
      hkDiscrepancy: 'Skip / Sleep',
    },
    maidManagement: {
      pickEmployeeEmpty: 'Bu vahid üçün boş işçi yoxdur. Struktur vahidini dəyişin və ya kadrdan bağlayın.',
      orgUnit: 'Struktur vahidi',
      orgUnitAll: 'Bütün vahidlər',
      unlink: 'Ayır',
      unlinked: 'Xidmətçi siyahıdan çıxarıldı',
    },
    housekeeping: {
      laundryWashPrice: 'Yuma qiyməti',
      laundryWashSum: 'Yuma məbləği',
      laundryIronPrice: 'Ütü qiyməti',
      laundryIronSum: 'Ütü məbləği',
      laundryTotalRow: 'Cəmi',
      laundryGrandTotal: 'Sifariş cəmi',
      laundryPreviewHint: 'Məbləğlər qonaq önbaxışıdır. Folio yalnız Təhvil basanda yazılır.',
      laundryCatalogEmpty: 'Kataloq boşdur. Qəbuldan əvvəl məhsul əlavə edin.',
      laundryOpenCheckoutHint:
        'Paltar hələ camaşırxanadadır. Return formu ilə təhvil verin, açıq talonu ləğv edin və ya gözləyin. Çıxış dialoqu arxada açıq qalır.',
      laundryDeliveredContinueCheckout: 'Camaşırxana təhvil verildi. Çıxış davam edir.',
      laundryVoidedContinueCheckout: 'Talon ləğv edildi. Çıxış davam edir.',
      laundryDeliveredMoreOpen: 'Bir talon təhvil verildi. Digər açıq talonlar qalır.',
      stayLinenHint: 'Boş buraxın — otel siyasəti (Ayarlar → Siyasətlər) tətbiq olunur.',
      forecastEmpty: 'Proqnoz pəncərəsində mərtəbə yoxdur. Otaqları və bron kitabını yoxlayın.',
      days1: 'Bu gün',
      days30: '30 gün',
      discrepancyCreateTitle: 'Skip və ya Sleep qeyd et',
      discrepancyCreate: 'Bayrağı saxla',
      mobilePickSelf: 'Təyin olunmuş mərtəbələri görmək üçün özünüzü seçin.',
      rotationHint:
        'Əvvəl qrafikdə növbə olmalıdır, sonra «Cütləri dəyiş». Standart cütlər: 2–3, 4–5, 6–7, 8–9, 10–11.',
      rotationSlotEmpty: 'Təyin olunmayıb',
      rotationSwapNeed: 'Dəyişmək üçün ən azı iki təyin olunmuş xidmətçi lazımdır',
      maidsLink: 'Xidmətçi paylanması',
      rosterLink: 'HK qrafik',
      closedEmptyOoo: 'OOO otaq yoxdur.',
      closedEmptyOos: 'OOS otaq yoxdur.',
      closedRoomsHint: 'OOO inventardan çıxır. OOS inventardadır, satılmır.',
      kindFilter: 'Növ',
      kindAll: 'Bütün növlər',
      laneOpen: 'Açıq gün',
      laneClosed: 'Bağlı günlər',
    },
  },
  ru: {
    nav: {
      hkStaffGroup: 'Персонал HK',
      hkMinibarGroup: 'Минибар',
      hkGuestServicesGroup: 'Гостевые услуги',
      hkMobile: 'HK мобильный',
      closedRoomList: 'Закрытые номера',
      hkDiscrepancy: 'Skip / Sleep',
    },
    maidManagement: {
      pickEmployeeEmpty: 'Нет свободных сотрудников для этого подразделения. Смените единицу или привяжите из кадров.',
      orgUnit: 'Структурная единица',
      orgUnitAll: 'Все подразделения',
      unlink: 'Отвязать',
      unlinked: 'Горничная убрана из списка',
    },
    housekeeping: {
      laundryWashPrice: 'Цена стирки',
      laundryWashSum: 'Сумма стирки',
      laundryIronPrice: 'Цена глажки',
      laundryIronSum: 'Сумма глажки',
      laundryTotalRow: 'Итого',
      laundryGrandTotal: 'Итого заказа',
      laundryPreviewHint: 'Суммы — превью для гостя. На фолио только после «Выдано».',
      laundryCatalogEmpty: 'Каталог пуст. Добавьте позиции до приёма.',
      laundryOpenCheckoutHint:
        'Вещи ещё в прачечной. Выдайте с формой возврата, аннулируйте открытый талон или подождите. Диалог выезда остаётся открытым.',
      laundryDeliveredContinueCheckout: 'Прачечная выдана. Выезд продолжается.',
      laundryVoidedContinueCheckout: 'Талон аннулирован. Выезд продолжается.',
      laundryDeliveredMoreOpen: 'Один талон выдан. Остались другие открытые талоны.',
      stayLinenHint: 'Пусто — действует политика отеля в Настройки → Политики.',
      forecastEmpty: 'В окне прогноза нет этажей. Проверьте номера и книгу броней.',
      days1: 'Сегодня',
      days30: '30 дней',
      discrepancyCreateTitle: 'Записать Skip или Sleep',
      discrepancyCreate: 'Сохранить флаг',
      mobilePickSelf: 'Выберите себя, чтобы видеть номера на своих этажах.',
      rotationHint:
        'Сначала смена в графике, затем «Сменить пары». Пары по умолчанию: 2–3, 4–5, 6–7, 8–9, 10–11.',
      rotationSlotEmpty: 'Не назначено',
      rotationSwapNeed: 'Нужны как минимум два назначенных сотрудника для обмена',
      maidsLink: 'Распределение горничных',
      rosterLink: 'График HK',
      closedEmptyOoo: 'Нет номеров OOO.',
      closedEmptyOos: 'Нет номеров OOS.',
      closedRoomsHint: 'OOO выводит из инвентаря. OOS остаётся в инвентаре, но не продаётся.',
      kindFilter: 'Вид',
      kindAll: 'Все виды',
      laneOpen: 'Открытый день',
      laneClosed: 'Закрытые дни',
    },
  },
};

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      deepMerge(target[k], v);
    } else if (target[k] === undefined || target[k] === null || target[k] === '') {
      target[k] = v;
    }
  }
}

for (const loc of ['en', 'az', 'ru']) {
  const file = path.join(root, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMerge(data, patches[loc]);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('patched', file);
}
