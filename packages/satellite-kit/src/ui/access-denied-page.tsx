"use client";

import { useEffect, useState } from "react";
import { ERA_I18N_COOKIE } from "@era/i18n-common";

const COPY = {
  en: {
    title: "No access to this section",
    body: "Your role does not include this section. The session stays signed in.",
    home: "Home",
  },
  az: {
    title: "Bu bölməyə icazəniz yoxdur",
    body: "Rolunuzda bu bölmə yoxdur. Sessiya açıq qalır.",
    home: "Ana səhifə",
  },
  ru: {
    title: "Нет доступа к этому разделу",
    body: "В вашей роли нет этого раздела. Сессия сохраняется.",
    home: "На главную",
  },
} as const;

type Locale = keyof typeof COPY;

function readLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const fromHtml = document.documentElement.lang?.slice(0, 2);
  if (fromHtml === "az" || fromHtml === "ru" || fromHtml === "en") return fromHtml;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ERA_I18N_COOKIE}=([^;]+)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  if (value === "az" || value === "ru" || value === "en") return value;
  return "en";
}

/** Signed-in staff who opened a screen their role does not grant. */
export function AccessDeniedPage() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    setLocale(readLocale());
  }, []);
  const copy = COPY[locale];
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-3 px-6 py-16">
      <h1 className="m-0 text-xl font-semibold text-[#34495E]">{copy.title}</h1>
      <p className="m-0 text-sm text-[#7F8C8D]">{copy.body}</p>
      <a href="/" className="text-sm font-medium text-[#1F6F8B]">
        {copy.home}
      </a>
    </main>
  );
}
