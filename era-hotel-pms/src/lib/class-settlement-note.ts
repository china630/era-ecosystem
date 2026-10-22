/** Sentences the card writes when someone answers who pays the class gap. */
const HOTEL_COVERS = [
  'Hotel covers the class difference (no extra charge).',
  'Otel sinif fərqini özü ödəyir (əlavə ödəniş yoxdur).',
  'Отель покрывает разницу классов (без доплаты).',
];

const SETTLED = [
  ...HOTEL_COVERS,
  'Guest pays the given class from today. Past nights stay as posted.',
  'Hotel refunds the difference. Charged class follows the given room from today.',
  'Guest asked for the cheaper class from today.',
  'Qonaq verilən sinfi bu gündən ödəyir. Keçmiş gecələr olduğu kimi qalır.',
  'Otel fərqi qaytarır. Ödənilən sinif bu gündən verilən otağa uyğun gəlir.',
  'Qonaq bu gündən daha ucuz sinif istəyib.',
  'Гость оплачивает выданный класс с сегодняшнего дня. Прошедшие ночи не переписываются.',
  'Отель возвращает разницу. Оплачиваемый класс с сегодняшнего дня совпадает с выданным.',
  'Гость с сегодняшнего дня просит более дешёвый класс.',
];

export function priceNoteChoosesHotel(note: string | null | undefined): boolean {
  const text = note ?? '';
  return HOTEL_COVERS.some((phrase) => text.includes(phrase));
}

export function priceNoteHasClassSettlement(note: string | null | undefined): boolean {
  const text = note ?? '';
  return SETTLED.some((phrase) => text.includes(phrase));
}
