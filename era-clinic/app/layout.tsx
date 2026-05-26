import type { Metadata } from "next";
import { APP_SHELL_CLASS, PlatformSessionBarServer } from "@era/satellite-kit/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERA Clinic",
  description: "ERA industry satellite — operational shell",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={APP_SHELL_CLASS}>
        <div className="mx-auto max-w-5xl px-4 py-6">
          <PlatformSessionBarServer />
          {children}
        </div>
      </body>
    </html>
  );
}
