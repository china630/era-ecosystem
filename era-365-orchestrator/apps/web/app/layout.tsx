import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_SHELL_CLASS } from "@era/satellite-kit/ui";
import { AppProviders } from "../components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERA 365 Orchestrator",
  description: "Control plane — identity, billing, industry launcher",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={APP_SHELL_CLASS}>
        <AppProviders>
          <div className="mx-auto min-h-screen max-w-5xl px-4 py-6">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}
