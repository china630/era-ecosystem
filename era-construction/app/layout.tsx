import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { APP_SHELL_CLASS, SatelliteAppProviders, SatelliteRootChrome } from "@era/satellite-kit/ui";
import ConstructionOpsShell from "@/components/ConstructionOpsShell";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={APP_SHELL_CLASS}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SatelliteAppProviders>
            <SatelliteRootChrome>
              <ConstructionOpsShell>{children}</ConstructionOpsShell>
            </SatelliteRootChrome>
          </SatelliteAppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
