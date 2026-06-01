import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { APP_SHELL_CLASS, SatelliteAppProviders, SatelliteRootChrome } from '@era/satellite-kit/ui';
import { HotelIntlProvider } from '@/components/HotelIntlProvider';
import HotelOpsShell from '@/components/HotelOpsShell';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={APP_SHELL_CLASS}>
        <HotelIntlProvider locale={locale} messages={messages}>
          <SatelliteAppProviders>
            <SatelliteRootChrome>
              <Suspense fallback={null}>
                <HotelOpsShell>{children}</HotelOpsShell>
              </Suspense>
            </SatelliteRootChrome>
          </SatelliteAppProviders>
        </HotelIntlProvider>
      </body>
    </html>
  );
}
