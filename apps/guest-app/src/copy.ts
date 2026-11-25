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
  laundryTitle: string;
  laundryEmpty: string;
  laundryWash: string;
  tourTitle: string;
  tourEmpty: string;
  tourBook: string;
  tourMine: string;
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
  accountTitle: string;
  accountLinked: string;
  accountGuest: string;
  languageTitle: string;
  settingsTitle: string;
  logout: string;
  signInTitle: string;
  signInBody: string;
  openAccount: string;
};

export const COPY: Record<"az" | "ru" | "en", Copy> = {
  az: {
    tabs: { today: "Bu gün", trip: "Səfər", care: "Müalicə", hotel: "Otel" },
    bell: "Mesajlar",
    phases: { before: "Gəlişdən əvvəl", in_house: "Oteldə", after: "Gedəndən sonra" },
    brandMissing: "Otel markası yoxdur",
    updated: "Yeniləndi",
    tripCached: "Səfər paketi cihazda",
    linkTitle: "Resepsiya kodu",
    linkHint: "Resepsiya QR və ya 6 rəqəmli kod — tam səfər paketini açır.",
    linkAction: "Telefonu bağla",
    linkFail: "Kod işləmədi",
    comingCard: "Biz bura gəlirik",
    refresh: "Yenilə",
    phaseBadge: "İndiki mərhələ",
    nextUp: "Növbəti",
    openTrip: "Səfərə keç",
    openCare: "Müalicəyə keç",
    openHotel: "Otel kataloqu",
    qTitle: "Anket",
    qHint: "Check-in üçün ad, soyad və sənəd. MRZ yaşıl olanda saxlayın.",
    qFirst: "Ad",
    qLast: "Soyad",
    qPassport: "Pasport",
    qSave: "Anketi saxla",
    qSaved: "Saxlanıldı",
    qFail: "Saxlanılmadı",
    mrzTitle: "Pasport MRZ",
    mrzRed: "Qırmızı — oxunmur",
    mrzGreen: "Yaşıl — oxundu",
    mrzHint: "MRZ sətirlərini yapışdırın",
    mrzCameraOpen: "Kameranı aç",
    mrzCameraClose: "Bağla",
    mrzCameraHint: "Kamera yoxdur — MRZ mətnini yazın",
    noTransfer: "Transfer yoxdur",
    transfersTitle: "Transferlər",
    bookingTitle: "Bron sorğusu",
    bookingHint: "Canlı otaq satışı deyil — otel cavab verir.",
    bookingSend: "Sorğu göndər",
    bookingOk: "Sorğu göndərildi",
    bookingFail: "Sorğu alınmadı",
    checkIn: "Giriş (YYYY-MM-DD)",
    checkOut: "Çıxış (YYYY-MM-DD)",
    adults: "Böyüklər",
    orderTitle: "Otaq sifarişi",
    orderHint: "Offline sifariş QUEUED qalır — otel qəbul etməyib.",
    orderSend: "İndi göndər",
    orderQueue: "Offline növbəyə yaz",
    orderQueuedLabel: "Növbədə (hələ oteldə deyil)",
    orderHotelLabel: "Oteldə",
    orderHotelEmpty: "Oteldə sifariş yoxdur",
    queueFlush: "Növbəni göndər",
    queueError: "Növbə xətası",
    queueEmpty: "Offline növbə boşdur",
    careEmpty: "Qrafik boşdur",
    careLocked: "Müalicə bağlıdır — resepsiya kodu və ya telefonla giriş lazımdır",
    careReason: "Səbəb",
    careTimetable: "Qrafik",
    careResults: "Nəşr olunmuş nəticələr",
    careEpisodes: "Keçmiş kurslar",
    hotelEmpty: "Kataloq hələ boşdur",
    hotelTitle: "Otel məlumatları",
    offersTitle: "Təkliflər",
    phoneAuthTitle: "Telefonla giriş",
    phoneAuthHint: "Sıra: SMS, sonra WhatsApp, sonra email.",
    phoneAuthSend: "Kod göndər",
    phoneAuthVerify: "Təsdiqlə",
    phoneAuthOk: "Telefon bağlandı",
    yes: "Bəli",
    no: "Xeyr",
    back: "Geri",
    confirmTitle: "Təsdiq № + soyad",
    confirmHint: "Məhdud paket: anket və tarixlər. Analizlər bağlı qalır.",
    confirmAction: "Məhdud aç",
    limitedPack: "Məhdud paket",
    marketingMute: "Marketinq: səssiz (klinika açıq qalır)",
    marketingOn: "Marketinq: açıq (klinika açıq qalır)",
    bellEmpty: "Mesaj yoxdur",
    bellTitle: "Gələn qutu",
    familyTitle: "Ailə kabineti",
    familyHint: "Başqa böyüyün qrafiki — resepsiya təsdiqindən sonra. Nəticələr bağlı qalır.",
    familyLink: "Qrafiki bu telefona aç",
    familyOk: "İcazə göndərildi — resepsiya təsdiqi lazımdır",
    familyFail: "İcazə alınmadı",
    folioTitle: "Folio",
    folioEmpty: "Folio sətirləri yoxdur",
    folioOpen: "Açıq",
    folioSettled: "Bağlı",
    boardTitle: "Yemək / board",
    boardEmpty: "Yemək planı hələ yoxdur",
    laundryTitle: "Camaşırxana",
    laundryEmpty: "Camaşırxana sifarişi yoxdur",
    laundryWash: "Yuma",
    tourTitle: "Turlar",
    tourEmpty: "Açıq tur yoxdur",
    tourBook: "Yer götür",
    tourMine: "Mənim turlarım",
    breakfast: "Səhər yeməyi",
    allInclusive: "All inclusive",
    room: "Otaq",
    emergencyTitle: "Təcili əlaqə",
    deskLabel: "Resepsiya",
    doctorLabel: "Həkim növbətçi",
    staleStamp: "Keş",
    channelSms: "SMS",
    channelWa: "WhatsApp",
    channelEmail: "Email",
    stayStatus: "Status",
    confirmation: "Təsdiq",
    needLink: "Səfəri açmaq üçün resepsiya kodu və ya telefon lazımdır.",
    accountTitle: "Hesabım",
    accountLinked: "Telefon səfərə bağlanıb",
    accountGuest: "Giriş edilməyib",
    languageTitle: "Dil",
    settingsTitle: "Parametrlər",
    logout: "Çıxış",
    signInTitle: "Giriş lazımdır",
    signInBody: "Səfəri açmaq üçün hesab menyusunda resepsiya kodu, telefon və ya təsdiq nömrəsi ilə daxil olun.",
    openAccount: "Hesaba keç",
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
    laundryTitle: "Прачечная",
    laundryEmpty: "Заявок в прачечную нет",
    laundryWash: "Стирка",
    tourTitle: "Туры",
    tourEmpty: "Открытых туров нет",
    tourBook: "Занять место",
    tourMine: "Мои туры",
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
    accountTitle: "Мой аккаунт",
    accountLinked: "Телефон привязан к поездке",
    accountGuest: "Вы не вошли",
    languageTitle: "Язык",
    settingsTitle: "Настройки",
    logout: "Выйти",
    signInTitle: "Нужен вход",
    signInBody: "Откройте аккаунт и войдите кодом стойки, телефоном или номером подтверждения.",
    openAccount: "Открыть аккаунт",
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
    laundryTitle: "Laundry",
    laundryEmpty: "No laundry tickets",
    laundryWash: "Wash",
    tourTitle: "Tours",
    tourEmpty: "No open tours",
    tourBook: "Take a seat",
    tourMine: "My tours",
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
    accountTitle: "My account",
    accountLinked: "Phone is linked to the trip",
    accountGuest: "Not signed in",
    languageTitle: "Language",
    settingsTitle: "Settings",
    logout: "Sign out",
    signInTitle: "Sign in required",
    signInBody: "Open Account and sign in with a desk code, phone, or confirmation number.",
    openAccount: "Open account",
  },
};
