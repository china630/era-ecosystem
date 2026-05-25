import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { SHELL_CLASS } from "@/lib/design-system";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={SHELL_CLASS}>
        <NextIntlClientProvider messages={messages}>
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
