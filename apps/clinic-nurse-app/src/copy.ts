export type Locale = "az" | "ru" | "en";

export function localeFromTag(tag: string | undefined): Locale {
  const base = (tag ?? "az").toLowerCase().split("-")[0];
  if (base === "ru" || base === "en" || base === "az") return base;
  return "az";
}

export type Copy = {
  login: string;
  password: string;
  orgNo: string;
  signIn: string;
  loginFailed: string;
  logout: string;
  offline: string;
  pending: string;
  lastSync: string;
  neverSynced: string;
  checkIn: string;
  checkInFailed: string;
  checkInOk: string;
  unpaidBlock: string;
  mineUnlinked: string;
  queueUpcoming: string;
  queueUpcomingEmpty: string;
  queueOverdue: string;
  queueOverdueEmpty: string;
  queueInProgress: string;
  queueInProgressEmpty: string;
  queueCompleted: string;
  queueCompletedEmpty: string;
  timeLabel: string;
  cabinLabel: string;
  colRoom: string;
  detailsTitle: string;
  detailsEmpty: string;
  detailsBodyPart: string;
  detailsSites: string;
  detailsMode: string;
  detailsFields: string;
  detailsNote: string;
  openAttendance: string;
  openAttendanceCabin: string;
  close: string;
  pinTitle: string;
  pinHint: string;
  pinWrong: string;
  status: Record<string, string>;
};

const az: Copy = {
  login: "Login",
  password: "Şifrə",
  orgNo: "Təşkilat nömrəsi",
  signIn: "Daxil ol",
  loginFailed: "Giriş alınmadı",
  logout: "Çıxış",
  offline: "Əlaqə yoxdur",
  pending: "Göndərilməyib",
  lastSync: "Son yenilənmə",
  neverSynced: "Hələ yüklənməyib",
  checkIn: "Check-in",
  checkInFailed: "Check-in uğursuz",
  checkInOk: "Check-in — prosedur gedir",
  unpaidBlock: "Ödənilməyib",
  mineUnlinked:
    "İstifadəçi practitionerə bağlı deyil. Adminden Practitioner.userId bağlanmasını istəyin.",
  queueUpcoming: "Növbə",
  queueUpcomingEmpty: "Növbədə heç kim yoxdur.",
  queueOverdue: "Gecikib",
  queueOverdueEmpty: "Gecikən yoxdur.",
  queueInProgress: "Davam edir",
  queueInProgressEmpty: "İndi gedən prosedur yoxdur.",
  queueCompleted: "Tamamlandı",
  queueCompletedEmpty: "Bitmiş prosedur hələ yoxdur.",
  timeLabel: "Vaxt",
  cabinLabel: "Kabina",
  colRoom: "Otaq",
  detailsTitle: "Həkim təyinatı",
  detailsEmpty: "Həkim əlavə qeyd yazmayıb.",
  detailsBodyPart: "Bədən nahiyəsi",
  detailsSites: "Zonalar",
  detailsMode: "Rejim",
  detailsFields: "Parametrlər",
  detailsNote: "Qeyd",
  openAttendance: "Sərbəst ziyarət",
  openAttendanceCabin: "Gəlişdə",
  close: "Bağla",
  pinTitle: "Kilidi aç",
  pinHint: "Xidmət PIN",
  pinWrong: "PIN səhvdir",
  status: {
    SCHEDULED: "Planlaşdırılıb",
    CHECKED_IN: "Davam edir",
    COMPLETED: "Tamamlanıb",
    NO_SHOW: "Gəlməyib",
    CANCELLED: "Ləğv",
    PENDING_PAY: "Ödəniş gözləyir",
  },
};

const ru: Copy = {
  login: "Логин",
  password: "Пароль",
  orgNo: "Номер организации",
  signIn: "Войти",
  loginFailed: "Вход не выполнен",
  logout: "Выход",
  offline: "Нет связи",
  pending: "Не отправлено",
  lastSync: "Обновлено",
  neverSynced: "Ещё не загружено",
  checkIn: "Check-in",
  checkInFailed: "Check-in не удался",
  checkInOk: "Чек-ин — процедура идёт",
  unpaidBlock: "Не оплачено",
  mineUnlinked:
    "Пользователь не связан с practitioner. Попросите админа связать Practitioner.userId.",
  queueUpcoming: "Очередь",
  queueUpcomingEmpty: "В очереди никого нет.",
  queueOverdue: "Опоздали",
  queueOverdueEmpty: "Опоздавших нет.",
  queueInProgress: "Идёт",
  queueInProgressEmpty: "Сейчас никто не на процедуре.",
  queueCompleted: "Готово",
  queueCompletedEmpty: "Завершённых ещё нет.",
  timeLabel: "Время",
  cabinLabel: "Кабина",
  colRoom: "Комната",
  detailsTitle: "Назначение врача",
  detailsEmpty: "Врач ничего не дописал.",
  detailsBodyPart: "Область тела",
  detailsSites: "Зоны",
  detailsMode: "Режим",
  detailsFields: "Параметры",
  detailsNote: "Примечание",
  openAttendance: "Свободное посещение",
  openAttendanceCabin: "При приходе",
  close: "Закрыть",
  pinTitle: "Снять киоск",
  pinHint: "Сервисный PIN",
  pinWrong: "Неверный PIN",
  status: {
    SCHEDULED: "Запланировано",
    CHECKED_IN: "В процессе",
    COMPLETED: "Завершено",
    NO_SHOW: "Неявка",
    CANCELLED: "Отменено",
    PENDING_PAY: "Ждёт оплаты",
  },
};

const en: Copy = {
  login: "Login",
  password: "Password",
  orgNo: "Organization number",
  signIn: "Sign in",
  loginFailed: "Sign-in failed",
  logout: "Sign out",
  offline: "Offline",
  pending: "Not sent",
  lastSync: "Updated",
  neverSynced: "Not loaded yet",
  checkIn: "Check-in",
  checkInFailed: "Check-in failed",
  checkInOk: "Checked in — procedure in progress",
  unpaidBlock: "Not paid",
  mineUnlinked:
    "This user is not linked to a practitioner. Ask an admin to set Practitioner.userId.",
  queueUpcoming: "Queue",
  queueUpcomingEmpty: "Nothing left in the queue.",
  queueOverdue: "Late",
  queueOverdueEmpty: "Nobody is late.",
  queueInProgress: "In progress",
  queueInProgressEmpty: "Nothing in progress.",
  queueCompleted: "Done",
  queueCompletedEmpty: "Nothing finished yet.",
  timeLabel: "Time",
  cabinLabel: "Cabin",
  colRoom: "Room",
  detailsTitle: "Doctor's order",
  detailsEmpty: "The doctor left this blank.",
  detailsBodyPart: "Body area",
  detailsSites: "Sites",
  detailsMode: "Mode",
  detailsFields: "Settings",
  detailsNote: "Note",
  openAttendance: "Open attendance",
  openAttendanceCabin: "On arrival",
  close: "Close",
  pinTitle: "Leave kiosk",
  pinHint: "Service PIN",
  pinWrong: "Wrong PIN",
  status: {
    SCHEDULED: "Scheduled",
    CHECKED_IN: "In progress",
    COMPLETED: "Completed",
    NO_SHOW: "No-show",
    CANCELLED: "Cancelled",
    PENDING_PAY: "Awaiting payment",
  },
};

const TABLE: Record<Locale, Copy> = { az, ru, en };

export function copyFor(locale: Locale): Copy {
  return TABLE[locale];
}
