#!/usr/bin/env node
/**
 * Applies DESIGN.md MVP shell (Tailwind + @era/satellite-kit/ui) to industry satellites.
 * Usage: node tools/apply-satellite-design-shell.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SATELLITES = [
  { dir: "era-retail-pos", title: "ERA Retail POS", homePath: "/pos" },
  { dir: "era-logistics", title: "ERA Logistics", homePath: "/trips" },
  { dir: "era-construction", title: "ERA Construction", homePath: "/projects" },
  { dir: "era-crm-field", title: "ERA CRM Field", homePath: "/leads" },
  { dir: "era-auto-sto", title: "ERA Auto STO", homePath: "/work-orders" },
  { dir: "era-wholesale", title: "ERA Wholesale", homePath: "/orders" },
  { dir: "era-clinic", title: "ERA Clinic", homePath: "/appointments" },
];

function w(filePath, content) {
  const full = path.join(root, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  console.log("wrote", filePath);
}

const tailwindConfig = `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
`;

const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-[#EBEDF0] text-[#34495E] antialiased;
}
`;

const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@era/satellite-kit"],
};

export default nextConfig;
`;

for (const s of SATELLITES) {
  const base = s.dir;

  w(`${base}/tailwind.config.ts`, tailwindConfig);
  w(`${base}/postcss.config.mjs`, postcssConfig);
  w(`${base}/app/globals.css`, globalsCss);

  w(
    `${base}/app/layout.tsx`,
    `import type { Metadata } from "next";
import { APP_SHELL_CLASS } from "@era/satellite-kit/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "${s.title}",
  description: "ERA industry satellite — operational shell",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={APP_SHELL_CLASS}>
        <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
`,
  );

  const mainPage = `${base}/app${s.homePath}/page.tsx`;
  if (fs.existsSync(path.join(root, mainPage))) {
    w(
      mainPage,
      `import Link from "next/link";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default function MainScreen() {
  return (
    <>
      <PageHeader
        title="${s.title}"
        subtitle="Operational MVP shell — UI follows DESIGN.md. See doc/ for delivery tracker."
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={\`\${CARD_CONTAINER_CLASS} p-6\`}>
        <p className="text-[13px] text-[#7F8C8D]">
          Registry screens and add/edit flows will use modals per DESIGN.md when implemented.
        </p>
      </div>
    </>
  );
}
`,
    );
  }

  w(
    `${base}/app/page.tsx`,
    `import Link from "next/link";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default function HomePage() {
  return (
    <>
      <PageHeader title="${s.title}" subtitle="ERA industry satellite" />
      <div className={\`\${CARD_CONTAINER_CLASS} p-6 space-y-4\`}>
        <p className="text-[13px] text-[#7F8C8D]">MVP operational shell aligned with DESIGN.md.</p>
        <ul className="space-y-2 text-[13px]">
          <li>
            <Link href="/api/health" className="font-medium text-[#2980B9] hover:underline">
              Health API
            </Link>
          </li>
          <li>
            <Link href="${s.homePath}" className={PRIMARY_BUTTON_CLASS}>
              Open main screen
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
`,
  );

  const pkgPath = path.join(root, `${base}/package.json`);
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.dependencies = pkg.dependencies ?? {};
    pkg.dependencies["@era/satellite-kit"] = "file:../packages/satellite-kit";
    pkg.devDependencies = pkg.devDependencies ?? {};
    if (!pkg.devDependencies.tailwindcss) {
      pkg.devDependencies.autoprefixer = "^10.4.21";
      pkg.devDependencies.postcss = "^8.5.4";
      pkg.devDependencies.tailwindcss = "^3.4.17";
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("updated", `${base}/package.json`);
  }
}

console.log("Done.");
