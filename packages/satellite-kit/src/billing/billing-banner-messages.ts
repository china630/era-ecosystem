/** Shell banner texts: same wording as Finance `billingEnforcement.*`. */
export const BILLING_BANNER_MESSAGES = {
  az: {
    SOFT_BLOCK:
      "Sizin ödənilməmiş hesabınız var. Export funksiyaları məhdudlaşdırılıb. Bloklanmanın qarşısını almaq üçün 6-na qədər ödəyin.",
    HARD_BLOCK:
      "Giriş məhdudlaşdırılıb. Sistem yalnız oxu rejimində işləyir. Davam etmək üçün hesabı ödəyin.",
  },
  ru: {
    SOFT_BLOCK:
      "У вас есть неоплаченный счет. Функции экспорта ограничены. Оплатите до 6-го числа во избежание блокировки.",
    HARD_BLOCK:
      "Доступ ограничен. Система работает в режиме чтения. Оплатите счет для возобновления работы.",
  },
  en: {
    SOFT_BLOCK:
      "You have an unpaid invoice. Export functions are restricted. Pay by the 6th to avoid a block.",
    HARD_BLOCK:
      "Access is restricted. The system is in read-only mode. Pay the invoice to resume work.",
  },
} as const;

export type BillingBannerLocale = keyof typeof BILLING_BANNER_MESSAGES;

export function billingBannerLocale(lang: string | null | undefined): BillingBannerLocale {
  const short = (lang ?? "").trim().slice(0, 2).toLowerCase();
  return short === "ru" || short === "en" ? short : "az";
}
