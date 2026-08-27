/** Shared copy for options + popup. Keep in sync with options.html data-i18n keys. */
const EW_BRIDGE_I18N = {
  en: {
    extName: "ERA Elektraweb Bridge",
    extTag: "Temporary dual-run — not a product",
    connection: "Connection",
    hotelUrl: "ERA Hotel PMS URL",
    organizationId: "ERA organization ID (hotel UUID)",
    fillOrg: "Fill ERA organization ID (hotel UUID).",
    login: "ERA login",
    password: "ERA password",
    btnLogin: "Log in & save",
    btnLogout: "Log out",
    sessionNone: "Not logged in",
    sessionOk: "Logged in. Token is bound to this hotel org.",
    fillAll: "Fill URL, login and password.",
    loginFailed: "Login failed",
    loggedOut: "Logged out.",
    desk: "This desk",
    deskHint: "Pick where this PC sits. Write (SPA tickets) only runs on sanatorium reception.",
    deskFo: "Hotel front office",
    deskFoHint: "Inbound only: reservations, guests, folio grids → ERA.",
    deskSan: "Sanatorium reception",
    deskSanHint: "SPA session. Extra tickets: guest folio, or house folio Tibbi Ambulator.",
    inbound: "Inbound (Elektraweb → ERA)",
    inboundToggle: "Capture & sync",
    inboundHint: "Forwards Elektraweb Select JSON to hotel ingest. Keep Elektraweb open on this PC.",
    lastSync: "Last sync",
    noSync: "No sync yet",
    queue: "Queue",
    flushNow: "Flush now",
    write: "SPA write (ERA → Elektraweb)",
    writeToggle: "Drain extra-ticket outbox",
    writeHint:
      "Issues SPA folio lines from ERA “Issue ticket”: in-house guest, or walk-in onto Tibbi Ambulator house folio. Hotel FO never drains this queue.",
    writeIdle:
      "Outbox API is live. Keep Elektraweb SPA open on this PC with write ON to drain extra tickets.",
    writeFoBlocked: "Write is off on hotel front office. Switch desk to sanatorium reception to enable.",
    status: "Status",
    ok: "OK",
    err: "Error",
    cutover: "Hour X",
    cutoverHint:
      "Disable inbound and write, uninstall this extension, revoke the bridge token. Clinic then posts extras to ERA folio.",
    openSettings: "Open settings",
    captureOn: "Capture ON",
    captureOff: "Capture OFF",
    writeOn: "Write ON",
    writeOff: "Write OFF",
    notLoggedIn: "Not logged in — open settings.",
    ewHotel: "EW hotel",
  },
  ru: {
    extName: "ERA — мост Elektraweb",
    extTag: "Временный dual-run — не продукт",
    connection: "Подключение",
    hotelUrl: "URL ERA Hotel PMS",
    organizationId: "ID организации ERA (UUID отеля)",
    fillOrg: "Укажите ID организации ERA (UUID отеля).",
    login: "Логин ERA",
    password: "Пароль ERA",
    btnLogin: "Войти и сохранить",
    btnLogout: "Выйти",
    sessionNone: "Нет сессии",
    sessionOk: "Вход выполнен. Токен привязан к этой гостинице.",
    fillAll: "Заполните URL, логин и пароль.",
    loginFailed: "Ошибка входа",
    loggedOut: "Выход выполнен.",
    desk: "Это рабочее место",
    deskHint: "Где стоит этот ПК. Запись чеков SPA — только ресепшен санатория.",
    deskFo: "Ресепшен отеля",
    deskFoHint: "Только входящее зеркало: брони, гости, folio → ERA.",
    deskSan: "Ресепшен санатория",
    deskSanHint: "Сессия SPA. Extra-чеки: folio гостя или дом Tibbi Ambulator.",
    inbound: "Входящий поток (Elektraweb → ERA)",
    inboundToggle: "Перехват и синхронизация",
    inboundHint: "Шлёт Select JSON в hotel ingest. Держите Elektraweb открытым на этом ПК.",
    lastSync: "Последняя синхронизация",
    noSync: "Ещё не было",
    queue: "Очередь",
    flushNow: "Сбросить сейчас",
    write: "Чеки SPA (ERA → Elektraweb)",
    writeToggle: "Сливать outbox extra-чеков",
    writeHint:
      "После «Выписать чек» в ERA ставит SPA-строки на folio гостя или на дом Tibbi Ambulator (walk-in). Стойка отеля эту очередь не сливает.",
    writeIdle:
      "Outbox API работает. Держите SPA Elektraweb открытым на этом ПК с записью ВКЛ, чтобы сливать extra-чеки.",
    writeFoBlocked: "На стойке отеля запись выключена. Для чеков выберите «Ресепшен санатория».",
    status: "Статус",
    ok: "ОК",
    err: "Ошибка",
    cutover: "Hour X",
    cutoverHint:
      "Выключить входящий поток и запись, удалить расширение, отозвать токен. Дальше extra идут в folio ERA.",
    openSettings: "Настройки",
    captureOn: "Перехват ВКЛ",
    captureOff: "Перехват ВЫКЛ",
    writeOn: "Запись ВКЛ",
    writeOff: "Запись ВЫКЛ",
    notLoggedIn: "Нет входа — откройте настройки.",
    ewHotel: "EW отель",
  },
  az: {
    extName: "ERA Elektraweb körpüsü",
    extTag: "Müvəqqəti dual-run — məhsul deyil",
    connection: "Qoşulma",
    hotelUrl: "ERA Hotel PMS URL",
    organizationId: "ERA təşkilat ID (otel UUID)",
    fillOrg: "ERA təşkilat ID-ni doldurun (otel UUID).",
    login: "ERA login",
    password: "ERA şifrə",
    btnLogin: "Daxil ol və yadda saxla",
    btnLogout: "Çıxış",
    sessionNone: "Sessiya yoxdur",
    sessionOk: "Daxil oldunuz. Token bu otelə bağlıdır.",
    fillAll: "URL, login və şifrəni doldurun.",
    loginFailed: "Giriş alınmadı",
    loggedOut: "Çıxış edildi.",
    desk: "Bu iş yeri",
    deskHint: "Bu PC haradadır. SPA çek yazısı yalnız sanatoriya resepsiyasındadır.",
    deskFo: "Otel resepsiyası",
    deskFoHint: "Yalnız inbound: rezervasiya, qonaq, folio → ERA.",
    deskSan: "Sanatoriya resepsiyası",
    deskSanHint: "SPA sessiyası. Extra çeklər: qonaq folio və ya Tibbi Ambulator ev folio.",
    inbound: "Inbound (Elektraweb → ERA)",
    inboundToggle: "Tutmaq və sinxron",
    inboundHint: "Select JSON-u hotel ingest-ə göndərir. Bu PC-də Elektraweb açıq qalsın.",
    lastSync: "Son sinxron",
    noSync: "Hələ yoxdur",
    queue: "Növbə",
    flushNow: "İndi göndər",
    write: "SPA yazısı (ERA → Elektraweb)",
    writeToggle: "Extra-çek outbox-unu boşalt",
    writeHint:
      "ERA “Çek yaz” sonrası SPA sətirləri qonaq folio-ya və ya walk-in üçün Tibbi Ambulator ev folio-ya. Otel resepsiyası bu növbəni boşaltmır.",
    writeIdle:
      "Outbox API işləyir. Extra çeklər üçün bu PC-də SPA Elektraweb açıq və yazı AÇIQ olsun.",
    writeFoBlocked: "Otel resepsiyasında yazı bağlıdır. Çeklər üçün sanatoriya resepsiyasını seçin.",
    status: "Status",
    ok: "OK",
    err: "Xəta",
    cutover: "Hour X",
    cutoverHint:
      "Inbound və yazını söndürün, genişləndirməni silin, tokeni ləğv edin. Extra sonra ERA folio-ya düşür.",
    openSettings: "Parametrlər",
    captureOn: "Tutma AÇIQ",
    captureOff: "Tutma BAĞLI",
    writeOn: "Yazı AÇIQ",
    writeOff: "Yazı BAĞLI",
    notLoggedIn: "Giriş yoxdur — parametrləri açın.",
    ewHotel: "EW otel",
  },
};

function ewLocale(raw) {
  return raw === "ru" || raw === "az" || raw === "en" ? raw : "ru";
}

function ewT(locale, key) {
  const pack = EW_BRIDGE_I18N[ewLocale(locale)] || EW_BRIDGE_I18N.ru;
  return pack[key] || EW_BRIDGE_I18N.en[key] || key;
}

function ewApplyI18n(root, locale) {
  const loc = ewLocale(locale);
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = ewT(loc, el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", ewT(loc, el.getAttribute("data-i18n-placeholder")));
  });
  const title = root.querySelector("title[data-i18n]");
  if (title) title.textContent = ewT(loc, title.getAttribute("data-i18n"));
}
