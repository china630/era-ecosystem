import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { APP_SHELL_CLASS, SatelliteAppProviders, SatelliteRootChrome } from "@era/satellite-kit/ui";
import CrmOpsShell from "@/components/CrmOpsShell";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
    manifest: "/manifest.webmanifest",
    themeColor: "#2C3E50",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#2C3E50" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={APP_SHELL_CLASS}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SatelliteAppProviders>
            <SatelliteRootChrome>
              <CrmOpsShell>{children}</CrmOpsShell>
            </SatelliteRootChrome>
          </SatelliteAppProviders>
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </body>
    </html>
  );
}
