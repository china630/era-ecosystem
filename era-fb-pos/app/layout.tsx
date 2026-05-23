import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SHELL_CLASS } from "@/lib/design-system";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERA F&B POS",
  description: "Restaurant floor, orders, and kitchen display",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={SHELL_CLASS}>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
