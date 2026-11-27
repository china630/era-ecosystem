import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@era/i18n-common";
import { DemoRequestForm } from "../../../components/site/demo-request-form";
import { SitePublicShell } from "../../../components/site/site-public-shell";
import { getSiteNavCopy } from "../../../lib/i18n/site-nav-copy";
import { fetchSiteCatalog } from "../../../lib/site/fetch-site-catalog";
import { fetchSiteContacts } from "../../../lib/site/fetch-site-contacts";
import { buildSiteMetadata, pageTitle } from "../../../lib/site/site-metadata";

export function generateStaticParams() {
  return [{ locale: "az" }, { locale: "ru" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw as Locale;
  const t = await getTranslations({ locale, namespace: "site.contact" });
  return buildSiteMetadata({
    locale,
    path: "/contact",
    title: pageTitle(t("title")),
    description: t("intro"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const [catalog, labels, contacts] = await Promise.all([
    fetchSiteCatalog(locale),
    Promise.resolve(getSiteNavCopy(locale)),
    fetchSiteContacts(),
  ]);

  const phone = contacts.phone || "+994 77 350 70 70";
  const e164 = contacts.phoneE164 || "+994773507070";
  const email = contacts.email || "chingiz@era-365.online";
  const wa = e164.replace(/\D/g, "");

  return (
    <SitePublicShell locale={locale} catalog={catalog}>
      <h1 className="m-0 text-2xl font-bold text-[#34495E]">{labels.contact}</h1>
      <ul className="mt-4 space-y-2 text-sm text-[#34495E]">
        <li>
          <a className="text-[#2980B9]" href={`tel:${e164}`}>
            {phone}
          </a>
        </li>
        <li>
          <a
            className="text-[#2980B9]"
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </li>
        <li>
          <a className="text-[#2980B9]" href={`mailto:${email}`}>
            {email}
          </a>
        </li>
      </ul>
      {contacts.address || contacts.legalName || contacts.voen ? (
        <div className="mt-6 text-sm text-[#7F8C8D]">
          {contacts.legalName ? <p>{contacts.legalName}</p> : null}
          {contacts.voen ? <p>VÖEN: {contacts.voen}</p> : null}
          {contacts.address ? <p>{contacts.address}</p> : null}
        </div>
      ) : null}
      <h2 className="mt-10 text-xl font-semibold text-[#34495E]">
        {labels.requestDemo}
      </h2>
      <DemoRequestForm locale={locale} catalog={catalog} source="contact_page" />
    </SitePublicShell>
  );
}
