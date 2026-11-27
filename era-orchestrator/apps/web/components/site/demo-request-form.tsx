"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@era/i18n-common";
import { track } from "../../lib/analytics/track";
import type { SiteCatalogResponse } from "../../lib/site/site-catalog-types";

const copy = {
  az: {
    name: "Ad",
    company: "Şirkət",
    phone: "Telefon",
    email: "E-poçt",
    industry: "Sənaye",
    message: "Mesaj",
    submit: "Göndər",
    success: "Sorğunuz qəbul olundu. Tezliklə əlaqə saxlayacağıq.",
    error: "Göndərmə alınmadı. Bir az sonra yenidən cəhd edin.",
    pickIndustry: "Seçin",
  },
  ru: {
    name: "Имя",
    company: "Компания",
    phone: "Телефон",
    email: "E-mail",
    industry: "Отрасль",
    message: "Сообщение",
    submit: "Отправить",
    success: "Заявка принята. Мы свяжемся с вами.",
    error: "Не удалось отправить. Попробуйте позже.",
    pickIndustry: "Выберите",
  },
  en: {
    name: "Name",
    company: "Company",
    phone: "Phone",
    email: "Email",
    industry: "Industry",
    message: "Message",
    submit: "Submit",
    success: "Request received. We will contact you shortly.",
    error: "Could not send. Please try again later.",
    pickIndustry: "Select",
  },
} as const;

export function DemoRequestForm({
  locale,
  catalog,
  source = "demo_page",
}: {
  locale: Locale;
  catalog: SiteCatalogResponse;
  source?: string;
}) {
  const t = copy[locale === "ru" ? "ru" : locale === "en" ? "en" : "az"];
  const [startedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [busy, setBusy] = useState(false);
  const industries = useMemo(() => catalog.industries ?? [], [catalog]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("idle");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      company: String(fd.get("company") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      industry: String(fd.get("industry") || ""),
      message: String(fd.get("message") || ""),
      website: String(fd.get("website") || ""),
      source,
      startedAt,
    };
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("fail");
      setStatus("ok");
      track("demo_form_submit", { location: source });
      e.currentTarget.reset();
    } catch {
      setStatus("err");
      track("demo_form_error", { location: source });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <label className="block text-sm text-[#34495E]">
        {t.name}
        <input
          required
          name="name"
          className="mt-1 w-full rounded-lg border border-[#D5DADF] px-3 py-2"
        />
      </label>
      <label className="block text-sm text-[#34495E]">
        {t.company}
        <input
          name="company"
          className="mt-1 w-full rounded-lg border border-[#D5DADF] px-3 py-2"
        />
      </label>
      <label className="block text-sm text-[#34495E]">
        {t.phone}
        <input
          name="phone"
          className="mt-1 w-full rounded-lg border border-[#D5DADF] px-3 py-2"
        />
      </label>
      <label className="block text-sm text-[#34495E]">
        {t.email}
        <input
          type="email"
          name="email"
          className="mt-1 w-full rounded-lg border border-[#D5DADF] px-3 py-2"
        />
      </label>
      <label className="block text-sm text-[#34495E]">
        {t.industry}
        <select
          name="industry"
          className="mt-1 w-full rounded-lg border border-[#D5DADF] px-3 py-2"
          defaultValue=""
        >
          <option value="">{t.pickIndustry}</option>
          {industries.map((ind) => (
            <option key={ind.slug} value={ind.slug}>
              {ind.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-[#34495E]">
        {t.message}
        <textarea
          name="message"
          rows={4}
          className="mt-1 w-full rounded-lg border border-[#D5DADF] px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[#2980B9] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        data-track="cta_demo_click"
        data-track-location="demo_page"
      >
        {t.submit}
      </button>
      {status === "ok" ? (
        <p className="text-sm text-emerald-700">{t.success}</p>
      ) : null}
      {status === "err" ? (
        <p className="text-sm text-red-600">{t.error}</p>
      ) : null}
    </form>
  );
}
