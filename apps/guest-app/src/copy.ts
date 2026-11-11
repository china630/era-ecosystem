export type Phase = "before" | "in_house" | "after";
export type TabId = "today" | "trip" | "care" | "hotel";

export type Copy = {
  tabs: Record<TabId, string>;
  bell: string;
  phases: Record<Phase, string>;
  brandMissing: string;
  updated: string;
  tripCached: string;
  linkTitle: string;
  linkHint: string;
  linkAction: string;
  linkFail: string;
  comingCard: string;
  refresh: string;
  phaseBadge: string;
  nextUp: string;
  openTrip: string;
  openCare: string;
  openHotel: string;
  qTitle: string;
  qHint: string;
  qFirst: string;
  qLast: string;
  qPassport: string;
  qSave: string;
  qSaved: string;
  qFail: string;
  mrzTitle: string;
  mrzRed: string;
  mrzGreen: string;
  mrzHint: string;
  mrzCameraOpen: string;
  mrzCameraClose: string;
  mrzCameraHint: string;
  noTransfer: string;
  transfersTitle: string;
  bookingTitle: string;
  bookingHint: string;
  bookingSend: string;
  bookingOk: string;
  bookingFail: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  orderTitle: string;
  orderHint: string;
  orderSend: string;
  orderQueue: string;
  orderQueuedLabel: string;
  orderHotelLabel: string;
  orderHotelEmpty: string;
  queueFlush: string;
  queueError: string;
  queueEmpty: string;
  careEmpty: string;
  careLocked: string;
  careReason: string;
  careTimetable: string;
  careResults: string;
  careEpisodes: string;
  hotelEmpty: string;
  hotelTitle: string;
  offersTitle: string;
  phoneAuthTitle: string;
  phoneAuthHint: string;
  phoneAuthSend: string;
  phoneAuthVerify: string;
  phoneAuthOk: string;
  yes: string;
  no: string;
  back: string;
  confirmTitle: string;
  confirmHint: string;
  confirmAction: string;
  limitedPack: string;
  marketingMute: string;
  marketingOn: string;
  bellEmpty: string;
  bellTitle: string;
  familyTitle: string;
  familyHint: string;
  familyLink: string;
  familyOk: string;
  familyFail: string;
  folioTitle: string;
  folioEmpty: string;
  folioOpen: string;
  folioSettled: string;
  boardTitle: string;
  boardEmpty: string;
  breakfast: string;
  allInclusive: string;
  room: string;
  emergencyTitle: string;
  deskLabel: string;
  doctorLabel: string;
  staleStamp: string;
  channelSms: string;
  channelWa: string;
  channelEmail: string;
  stayStatus: string;
  confirmation: string;
  needLink: string;
};

export const COPY: Record<"az" | "ru" | "en", Copy> = {
  az: {
    tabs: { today: "Bu gun", trip: "Sefer", care: "Mualice", hotel: "Otel" },
    bell: "Mesajlar",
    phases: { before: "Gelisden evvel", in_house: "Otelde", after: "Gedenden sonra" },
    brandMissing: "Otel markasi yoxdur",
    updated: "Yenilendi",
    tripCached: "Sefer paketi cihazda",
    linkTitle: "Resepsiya kodu",
    linkHint: "Desk QR ve ya 6 reqemli kod — tam sefer paketini acir.",
    linkAction: "Telefonu bagla",
    linkFail: "Kod islemadi",
    comingCard: "Biz bura gelirik",
    refresh: "Yenile",
    phaseBadge: "Indiki merhele",
    nextUp: "Novbeti",
    openTrip: "Sefere kec",
    openCare: "Mualiceye kec",
    openHotel: "Otel katalogu",
    qTitle: "Anket",
    qHint: "Check-in uchun ad, soyad ve sened. MRZ yesil olanda savet.",
    qFirst: "Ad",
    qLast: "Soyad",
    qPassport: "Pasport",
    qSave: "Anketi saxla",
    qSaved: "Saxlandi",
    qFail: "Saxlanilmadi",
    mrzTitle: "Pasport MRZ",
    mrzRed: "Qirmizi — oxunmur",
    mrzGreen: "Yasil — oxundu",
    mrzHint: "MRZ setirlerini yapisdirin",
    mrzCameraOpen: "Kamerani ac",
    mrzCameraClose: "Bagla",
    mrzCameraHint: "Kamera yoxdur — MRZ metnini yazin",
    noTransfer: "Transfer yoxdur",
    transfersTitle: "Transferler",
    bookingTitle: "Bron sorgusu",
    bookingHint: "Canli otaq satisi deyil — otel cavab verir.",
    bookingSend: "Sorgu gonder",
    bookingOk: "Sorgu gonderildi",
    bookingFail: "Sorgu alinmadi",
    checkIn: "Girish (YYYY-MM-DD)",
    checkOut: "Chixish (YYYY-MM-DD)",
    adults: "Boyukler",
    orderTitle: "Otaq sifarishi",
    orderHint: "Offline sifarish QUEUED qalir — otel qebul etmeyib.",
    orderSend: "Indi gonder",
    orderQueue: "Offline novbeye yaz",
    orderQueuedLabel: "Novbede (hele otelde deyil)",
    orderHotelLabel: "Otelde",
    orderHotelEmpty: "Otelde sifarish yoxdur",
    queueFlush: "Novbeni gonder",
    queueError: "Novbe xetasi",
    queueEmpty: "Offline novbe boshdur",
    careEmpty: "Qrafik boshdur",
    careLocked: "Mualice baglidir — resepsiya kodu ve ya telefonla girish lazimdir",
    careReason: "Sebeb",
    careTimetable: "Qrafik",
    careResults: "Neshr olunmush neticeler",
    careEpisodes: "Kechmish kurslar",
    hotelEmpty: "Katalog hele boshdur",
    hotelTitle: "Otel melumatlari",
    offersTitle: "Teklifler",
    phoneAuthTitle: "Telefonla girish",
    phoneAuthHint: "Siralam: SMS, sonra WhatsApp, sonra email.",
    phoneAuthSend: "Kod gonder",
    phoneAuthVerify: "Tesdiqle",
    phoneAuthOk: "Telefon baglandi",
    yes: "Beli",
    no: "Xeyr",
    back: "Geri",
    confirmTitle: "Tesdiq № + soyad",
    confirmHint: "Mehdud paket: anket ve tarixler. Analizler bagli qalir.",
    confirmAction: "Mehdud ac",
    limitedPack: "Mehdud paket",
    marketingMute: "Marketing: sessiz (klinika achiq qalir)",
    marketingOn: "Marketing: achiq (klinika achiq qalir)",
    bellEmpty: "Mesaj yoxdur",
    bellTitle: "Gelen qutu",
    familyTitle: "Aile kabineti",
    familyHint: "Bashqa boyuyun qrafiki — resepsiya tesdiqinden sonra. Neticeler bagli qalir.",
    familyLink: "Qrafiki bu telefona ac",
    familyOk: "Icaze gonderildi — resepsiya tesdiqi lazimdir",
    familyFail: "Icaze alinmadi",
    folioTitle: "Folio",
    folioEmpty: "Folio setirleri yoxdur",
    folioOpen: "Achiq",
    folioSettled: "Bagli",
    boardTitle: "Yemek / board",
    boardEmpty: "Yemek plani hele yoxdur",
    breakfast: "Seher yemeyi",
    allInclusive: "All inclusive",
    room: "Otaq",
    emergencyTitle: "Tecili elaqe",
    deskLabel: "Resepsiya",
    doctorLabel: "Hekim novbetci",
    staleStamp: "Keş",
    channelSms: "SMS",
    channelWa: "WhatsApp",
    channelEmail: "Email",
    stayStatus: "Status",
    confirmation: "Tesdiq",
    needLink: "Seferi acmaq uchun resepsiya kodu ve ya telefon lazimdir.",
  },
  ru: {
    tabs: { today: "Сегодня", trip: "Поездка", care: "Лечение", hotel: "Отель" },
    bell: "Сообщения",
    phases: { before: "До заезда", in_house: "В отеле", after: "После отъезда" },
    brandMissing: "Марка отеля не задана",
    updated: "Обновлено",
    tripCached: "Пакет поездки на устройстве",
    linkTitle: "Код со стойки",
    linkHint: "QR стойки или 6-значный код открывает полный пакет поездки.",
    linkAction: "Привязать телефон",
    linkFail: "Код не подошёл",
    comingCard: "Мы едем сюда",
    refresh: "Обновить",
    phaseBadge: "Текущий этап",
    nextUp: "Дальше",
    openTrip: "К поездке",
    openCare: "К лечению",
    openHotel: "Каталог отеля",
    qTitle: "Анкета",
    qHint: "Для check-in нужны имя, фамилия и документ. Сохраните при зелёном MRZ.",
    qFirst: "Имя",
    qLast: "Фамилия",
    qPassport: "Паспорт",
    qSave: "Сохранить анкету",
    qSaved: "Сохранено",
    qFail: "Не сохранилось",
    mrzTitle: "Паспорт MRZ",
    mrzRed: "Красная — не читается",
    mrzGreen: "Зелёная — считано",
    mrzHint: "Вставьте строки MRZ",
    mrzCameraOpen: "Открыть камеру",
    mrzCameraClose: "Закрыть",
    mrzCameraHint: "Нет камеры — введите MRZ текстом",
    noTransfer: "Трансфера нет",
    transfersTitle: "Трансферы",
    bookingTitle: "Заявка на бронь",
    bookingHint: "Не живая продажа номера — отель отвечает на запрос.",
    bookingSend: "Отправить запрос",
    bookingOk: "Заявка отправлена",
    bookingFail: "Не удалось отправить",
    checkIn: "Заезд (YYYY-MM-DD)",
    checkOut: "Выезд (YYYY-MM-DD)",
    adults: "Взрослые",
    orderTitle: "Заказ в номер",
    orderHint: "Офлайн-заказ остаётся QUEUED — отель ещё не принял.",
    orderSend: "Отправить сейчас",
    orderQueue: "В офлайн-очередь",
    orderQueuedLabel: "В очереди (ещё не в отеле)",
    orderHotelLabel: "В отеле",
    orderHotelEmpty: "В отеле заказов нет",
    queueFlush: "Отправить очередь",
    queueError: "Ошибка очереди",
    queueEmpty: "Офлайн-очередь пуста",
    careEmpty: "Расписание пусто",
    careLocked: "Кабинет закрыт — нужен код стойки или вход по телефону",
    careReason: "Причина",
    careTimetable: "Расписание",
    careResults: "Опубликованные результаты",
    careEpisodes: "Прошлые курсы",
    hotelEmpty: "Каталог пока пуст",
    hotelTitle: "Информация отеля",
    offersTitle: "Предложения",
    phoneAuthTitle: "Вход по телефону",
    phoneAuthHint: "Порядок: SMS, затем WhatsApp, затем email.",
    phoneAuthSend: "Отправить код",
    phoneAuthVerify: "Подтвердить",
    phoneAuthOk: "Телефон привязан",
    yes: "Да",
    no: "Нет",
    back: "Назад",
    confirmTitle: "Подтверждение + фамилия",
    confirmHint: "Ограниченный пакет: анкета и даты. Анализы остаются закрытыми.",
    confirmAction: "Открыть ограниченно",
    limitedPack: "Ограниченный пакет",
    marketingMute: "Маркетинг: выкл (клиника остаётся вкл)",
    marketingOn: "Маркетинг: вкл (клиника остаётся вкл)",
    bellEmpty: "Сообщений нет",
    bellTitle: "Входящие",
    familyTitle: "Семейный кабинет",
    familyHint: "Расписание другого взрослого — после подтверждения стойки. Результаты закрыты.",
    familyLink: "Открыть расписание на этом телефоне",
    familyOk: "Запрос отправлен — нужно подтверждение стойки",
    familyFail: "Не удалось",
    folioTitle: "Фолио",
    folioEmpty: "Нет строк фолио",
    folioOpen: "Открыто",
    folioSettled: "Закрыто",
    boardTitle: "Питание / board",
    boardEmpty: "План питания пока не задан",
    breakfast: "Завтрак",
    allInclusive: "All inclusive",
    room: "Номер",
    emergencyTitle: "Экстренные контакты",
    deskLabel: "Ресепшн",
    doctorLabel: "Дежурный врач",
    staleStamp: "Кэш",
    channelSms: "SMS",
    channelWa: "WhatsApp",
    channelEmail: "Email",
    stayStatus: "Статус",
    confirmation: "Подтверждение",
    needLink: "Чтобы открыть поездку, нужен код стойки или вход по телефону.",
  },
  en: {
    tabs: { today: "Today", trip: "Trip", care: "Care", hotel: "Hotel" },
    bell: "Messages",
    phases: { before: "Before arrival", in_house: "In house", after: "After departure" },
    brandMissing: "Hotel brand is not set",
    updated: "Updated",
    tripCached: "Trip pack on this device",
    linkTitle: "Desk code",
    linkHint: "Desk QR or 6-digit code opens the full trip pack.",
    linkAction: "Link phone",
    linkFail: "Code did not work",
    comingCard: "We are coming here",
    refresh: "Refresh",
    phaseBadge: "Current phase",
    nextUp: "Next",
    openTrip: "Go to Trip",
    openCare: "Go to Care",
    openHotel: "Hotel catalog",
    qTitle: "Questionnaire",
    qHint: "Check-in needs name and document. Save when the MRZ frame is green.",
    qFirst: "First name",
    qLast: "Last name",
    qPassport: "Passport",
    qSave: "Save questionnaire",
    qSaved: "Saved",
    qFail: "Could not save",
    mrzTitle: "Passport MRZ",
    mrzRed: "Red — not readable",
    mrzGreen: "Green — captured",
    mrzHint: "Paste MRZ lines",
    mrzCameraOpen: "Open camera",
    mrzCameraClose: "Close",
    mrzCameraHint: "No camera — paste MRZ text",
    noTransfer: "No transfer",
    transfersTitle: "Transfers",
    bookingTitle: "Booking request",
    bookingHint: "Not a live room sale — the hotel answers the request.",
    bookingSend: "Send request",
    bookingOk: "Request sent",
    bookingFail: "Could not send",
    checkIn: "Check-in (YYYY-MM-DD)",
    checkOut: "Check-out (YYYY-MM-DD)",
    adults: "Adults",
    orderTitle: "Room order",
    orderHint: "Offline orders stay QUEUED — the hotel has not accepted them yet.",
    orderSend: "Send now",
    orderQueue: "Queue offline",
    orderQueuedLabel: "Queued (not hotel-accepted)",
    orderHotelLabel: "At hotel",
    orderHotelEmpty: "No hotel-accepted orders",
    queueFlush: "Flush queue",
    queueError: "Queue error",
    queueEmpty: "Offline queue is empty",
    careEmpty: "Timetable is empty",
    careLocked: "Care locked — desk code or phone sign-in required",
    careReason: "Reason",
    careTimetable: "Timetable",
    careResults: "Published results",
    careEpisodes: "Past courses",
    hotelEmpty: "Catalog is empty",
    hotelTitle: "Hotel information",
    offersTitle: "Offers",
    phoneAuthTitle: "Sign in with phone",
    phoneAuthHint: "Order: SMS, then WhatsApp, then email.",
    phoneAuthSend: "Send code",
    phoneAuthVerify: "Verify",
    phoneAuthOk: "Phone linked",
    yes: "Yes",
    no: "No",
    back: "Back",
    confirmTitle: "Confirmation + surname",
    confirmHint: "Limited pack: questionnaire and dates. Results stay locked.",
    confirmAction: "Open limited",
    limitedPack: "Limited pack",
    marketingMute: "Marketing: muted (clinic stays on)",
    marketingOn: "Marketing: on (clinic stays on)",
    bellEmpty: "No messages",
    bellTitle: "Inbox",
    familyTitle: "Family cabinet",
    familyHint: "Another adult’s timetable — after desk confirm. Results stay closed.",
    familyLink: "Show their timetable on this phone",
    familyOk: "Grant sent — desk must confirm",
    familyFail: "Could not create grant",
    folioTitle: "Folio",
    folioEmpty: "No folio lines",
    folioOpen: "Open",
    folioSettled: "Settled",
    boardTitle: "Board / meals",
    boardEmpty: "Meal plan not set yet",
    breakfast: "Breakfast",
    allInclusive: "All inclusive",
    room: "Room",
    emergencyTitle: "Emergency contacts",
    deskLabel: "Desk",
    doctorLabel: "Doctor on duty",
    staleStamp: "Cached",
    channelSms: "SMS",
    channelWa: "WhatsApp",
    channelEmail: "Email",
    stayStatus: "Status",
    confirmation: "Confirmation",
    needLink: "Link with a desk code or phone sign-in to open the trip.",
  },
};
