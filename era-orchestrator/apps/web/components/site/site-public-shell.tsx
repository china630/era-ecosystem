import type { ReactNode } from "react";
import type { Locale } from "@era/i18n-common";
import { getSiteNavCopy } from "../../lib/i18n/site-nav-copy";
import { fetchSiteCatalog } from "../../lib/site/fetch-site-catalog";
import type { SiteCatalogResponse } from "../../lib/site/site-catalog-types";
import { LandingPageShell } from "../landing/landing-page-shell";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export async function SitePublicShell({
  locale,
  catalog: catalogProp,
  children,
}: {
  locale: Locale;
  /** Pass when the page already fetched the catalog (avoid a second fetch). */
  catalog?: SiteCatalogResponse;
  children: ReactNode;
}) {
  const catalog = catalogProp ?? (await fetchSiteCatalog(locale));
  const labels = getSiteNavCopy(locale);
  return (
    <LandingPageShell>
      <SiteHeader locale={locale} catalog={catalog} labels={labels} />
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <SiteFooter
        locale={locale}
        catalog={catalog}
        labels={labels}
        contactExtras={{
          address: catalog.contact?.address,
          legalName: catalog.contact?.legalName,
          voen: catalog.contact?.voen,
        }}
      />
    </LandingPageShell>
  );
}
