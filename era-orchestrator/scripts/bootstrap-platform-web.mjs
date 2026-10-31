/**
 * One-shot scaffold for apps/platform-web (vendor operator console).
 * Copies super-admin pages with short paths + shared libs/components.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcWeb = path.join(root, "apps/web");
const dest = path.join(root, "apps/platform-web");

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}
function write(p, content) {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}
function read(p) {
  return fs.readFileSync(p, "utf8");
}
function copyFile(from, to) {
  mkdirp(path.dirname(to));
  fs.copyFileSync(from, to);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
mkdirp(dest);

function rewritePage(content) {
  let c = content;
  c = c.replace(/from\s+["']((?:\.\.\/)+)lib\//g, 'from "@/lib/');
  c = c.replace(/from\s+["']((?:\.\.\/)+)components\//g, 'from "@/components/');
  c = c.replaceAll("/super-admin/", "/");
  c = c.replaceAll('"/super-admin"', '"/"');
  c = c.replaceAll("'/super-admin'", "'/'");
  return c;
}

function walkCopyPages(fromDir, toDir) {
  for (const name of fs.readdirSync(fromDir)) {
    const from = path.join(fromDir, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      walkCopyPages(from, path.join(toDir, name));
      continue;
    }
    if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
    const raw = read(from);
    write(path.join(toDir, name), rewritePage(raw));
  }
}

// --- package / configs ---
write(
  path.join(dest, "package.json"),
  JSON.stringify(
    {
      name: "@era365/platform-web",
      version: "0.0.1",
      private: true,
      scripts: {
        dev: "next dev -p 3001",
        build: "next build",
        start: "next start -p 3001",
      },
      dependencies: {
        "@era/i18n-common": "file:../../../packages/i18n-common",
        "@era/satellite-kit": "file:../../../packages/satellite-kit",
        next: "^15.3.3",
        "next-intl": "^4.12.0",
        "lucide-react": "^1.7.0",
        zod: "^3.25.36",
        react: "^19.1.0",
        "react-dom": "^19.1.0",
        sonner: "^2.0.3",
      },
      devDependencies: {
        "@tailwindcss/postcss": "^4.2.2",
        "@types/node": "^22.15.21",
        "@types/react": "^19.1.4",
        "@types/react-dom": "^19.1.5",
        autoprefixer: "^10.4.21",
        postcss: "^8.5.4",
        tailwindcss: "^4.2.2",
        typescript: "^5.7.3",
      },
    },
    null,
    2,
  ) + "\n",
);

write(path.join(dest, "tsconfig.json"), read(path.join(srcWeb, "tsconfig.json")));
write(path.join(dest, "next.config.ts"), read(path.join(srcWeb, "next.config.ts")));
write(path.join(dest, "postcss.config.mjs"), read(path.join(srcWeb, "postcss.config.mjs")));
write(path.join(dest, "tailwind.config.js"), read(path.join(srcWeb, "tailwind.config.js")));
write(path.join(dest, "next-env.d.ts"), read(path.join(srcWeb, "next-env.d.ts")));

write(
  path.join(dest, "middleware.ts"),
  `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eraPathnameRequestHeaders } from "@era/satellite-kit/auth/middleware-edge";

export function middleware(request: NextRequest) {
  const reqHeaders = eraPathnameRequestHeaders(
    request.headers,
    request.nextUrl.pathname,
  );
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
`,
);

write(
  path.join(dest, "i18n/request.ts"),
  `import { createNextIntlRequest } from "@era/i18n-common/server";

export default createNextIntlRequest(async (locale) => {
  if (locale === "az") {
    return (await import("../messages/az.json")).default as Record<string, unknown>;
  }
  return (await import(\`../messages/\${locale}.json\`)).default as Record<string, unknown>;
});
`,
);

for (const loc of ["en", "ru", "az"]) {
  const msg = JSON.parse(read(path.join(srcWeb, "messages", `${loc}.json`)));
  if (loc === "en") {
    msg.meta = {
      title: "ERA Platform Console",
      description: "Vendor operator console — billing, MDM, orgs",
    };
    msg.auth.operatorOnly = "This console is for ERA platform operators only.";
  } else if (loc === "ru") {
    msg.meta = {
      title: "ERA Platform Console",
      description: "Консоль оператора ERA — биллинг, MDM, организации",
    };
    msg.auth.operatorOnly = "Эта консоль только для операторов платформы ERA.";
  } else {
    msg.meta = {
      title: "ERA Platform Console",
      description: "ERA operator konsolu — billing, MDM, təşkilatlar",
    };
    msg.auth.operatorOnly = "Bu konsol yalnız ERA platforma operatorları üçündür.";
  }
  write(path.join(dest, "messages", `${loc}.json`), JSON.stringify(msg, null, 2) + "\n");
}

let css = read(path.join(srcWeb, "app/globals.css"));
css = css
  .replace(
    '@source "../../components/**/*.{js,ts,jsx,tsx,mdx}";',
    '@source "../components/**/*.{js,ts,jsx,tsx,mdx}";',
  )
  .replace(
    '@source "../../lib/**/*.{js,ts,jsx,tsx,mdx}";',
    '@source "../lib/**/*.{js,ts,jsx,tsx,mdx}";',
  );
write(path.join(dest, "app/globals.css"), css);

// --- libs ---
const orchApi = read(path.join(srcWeb, "lib/orch-api.ts"))
  .replaceAll("era_orch_access_token", "era_platform_access_token")
  .replaceAll("era_orch_refresh_token", "era_platform_refresh_token");
write(path.join(dest, "lib/orch-api.ts"), orchApi);

copyFile(path.join(srcWeb, "lib/cp-admin-fetch.ts"), path.join(dest, "lib/cp-admin-fetch.ts"));
copyFile(path.join(srcWeb, "lib/billing-types.ts"), path.join(dest, "lib/billing-types.ts"));
copyFile(
  path.join(srcWeb, "lib/use-list-pagination.ts"),
  path.join(dest, "lib/use-list-pagination.ts"),
);
copyFile(path.join(srcWeb, "lib/locale-client.ts"), path.join(dest, "lib/locale-client.ts"));

write(
  path.join(dest, "lib/auth-context.tsx"),
  `"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ORCH_TOKEN_KEY,
  accessTokenExpiresAtMs,
  clearOrchTokens,
  getOrchAccessToken,
  isAccessTokenUsable,
  notifyOrchSessionExpired,
  orchFetch,
  refreshOrchAccessToken,
  setOrchTokens,
  subscribeOrchSession,
} from "./orch-api";

export type OrchUser = {
  id: string;
  email: string;
  organizationId: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
};

type JwtClaims = {
  sub?: string;
  email?: string;
  organizationId?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
};

function userFromToken(accessToken: string): OrchUser {
  const payload = JSON.parse(atob(accessToken.split(".")[1] ?? "")) as JwtClaims;
  return {
    id: payload.sub ?? "",
    email: payload.email ?? "",
    organizationId: payload.organizationId ?? null,
    role: payload.role ?? null,
    isSuperAdmin: payload.isSuperAdmin ?? false,
  };
}

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  login: (accessToken: string, user: OrchUser, refreshToken?: string | null) => void;
  logout: () => void;
};

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.replace("/login?reason=expired");
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<OrchUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const stored = localStorage.getItem(ORCH_TOKEN_KEY);
      if (!stored) {
        const refreshed = await refreshOrchAccessToken();
        if (cancelled) return;
        if (!refreshed) {
          setReady(true);
          return;
        }
        try {
          const next = userFromToken(refreshed);
          if (!next.isSuperAdmin) {
            clearOrchTokens();
            setReady(true);
            return;
          }
          setToken(refreshed);
          setUser(next);
          setReady(true);
        } catch {
          clearOrchTokens();
          setReady(true);
        }
        return;
      }
      let access = stored;
      if (!isAccessTokenUsable(stored, 30_000)) {
        const refreshed = await refreshOrchAccessToken();
        if (cancelled) return;
        if (!refreshed) {
          clearOrchTokens();
          setReady(true);
          redirectToLogin();
          return;
        }
        access = refreshed;
      }
      try {
        const next = userFromToken(access);
        if (!next.isSuperAdmin) {
          clearOrchTokens();
          setReady(true);
          return;
        }
        setToken(access);
        setUser(next);
        setReady(true);
      } catch {
        clearOrchTokens();
        setReady(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    (accessToken: string, nextUser: OrchUser, refreshToken?: string | null) => {
      setOrchTokens(accessToken, refreshToken);
      setToken(accessToken);
      setUser({ ...nextUser, isSuperAdmin: true });
    },
    [],
  );

  const logout = useCallback(() => {
    clearOrchTokens();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    return subscribeOrchSession({
      onExpired: () => {
        setToken(null);
        setUser(null);
        redirectToLogin();
      },
      onRefreshed: (accessToken) => {
        setToken(accessToken);
        try {
          const next = userFromToken(accessToken);
          if (!next.isSuperAdmin) {
            clearOrchTokens();
            setToken(null);
            setUser(null);
            redirectToLogin();
            return;
          }
          setUser(next);
        } catch {
          /* keep previous user */
        }
      },
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    const exp = accessTokenExpiresAtMs(token);
    if (exp == null) return;
    const delay = Math.max(5_000, exp - Date.now() - 90_000);
    const id = window.setTimeout(() => {
      void refreshOrchAccessToken().then((fresh) => {
        if (fresh) return;
        const current = getOrchAccessToken();
        if (current && isAccessTokenUsable(current, 0)) return;
        notifyOrchSessionExpired();
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [token]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ORCH_TOKEN_KEY) return;
      if (e.newValue == null) {
        setToken(null);
        setUser(null);
        redirectToLogin();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ ready, token, user, login, logout }),
    [ready, token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
`,
);

// --- components ---
copyFile(
  path.join(srcWeb, "components/super-admin-data-table.tsx"),
  path.join(dest, "components/super-admin-data-table.tsx"),
);
copyFile(
  path.join(srcWeb, "components/layout/sidebar-primitives.tsx"),
  path.join(dest, "components/layout/sidebar-primitives.tsx"),
);
copyFile(
  path.join(srcWeb, "components/locale/orch-language-switcher.tsx"),
  path.join(dest, "components/locale/orch-language-switcher.tsx"),
);

write(
  path.join(dest, "components/layout/platform-sidebar.tsx"),
  `"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarClock,
  CreditCard,
  Database,
  Gauge,
  Library,
  Package,
  PanelLeftClose,
  PanelRightClose,
  Radio,
  Settings,
  ShieldAlert,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { EraAppSidebar } from "@era/satellite-kit/ui";
import {
  CollapsibleNavSection,
  SideNavItem,
  SidebarLayoutProvider,
  SidebarLogo,
} from "./sidebar-primitives";

export function PlatformSidebar({
  mobileNavOpen,
  onNavClick,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
}: {
  mobileNavOpen: boolean;
  onNavClick: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
}) {
  const pathname = usePathname() ?? "";
  const t = useTranslations("nav");
  const [layoutWide, setLayoutWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLayoutWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const layoutCollapsed = Boolean(sidebarCollapsed && layoutWide);

  return (
    <EraAppSidebar
      id="platform-main-sidebar"
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={layoutCollapsed}
      navClassName={layoutCollapsed ? "lg:px-2" : ""}
      header={
        <>
          <div className={["shrink-0 p-5", layoutCollapsed ? "lg:px-2 lg:py-4" : ""].join(" ")}>
            <SidebarLogo
              title="ERA Platform"
              subtitle={t("sectionPlatform")}
              layoutCollapsed={layoutCollapsed}
            />
          </div>
          <div className="mx-3 h-px shrink-0 bg-gray-200" />
        </>
      }
      footer={
        <button
          type="button"
          className="hidden w-full items-center justify-center rounded-lg border border-transparent p-2 text-gray-600 transition hover:border-gray-200 hover:bg-white/70 lg:flex"
          onClick={onToggleSidebarCollapsed}
          aria-label={
            sidebarCollapsed ? t("sidebarExpandAria") : t("sidebarCollapseAria")
          }
        >
          {sidebarCollapsed ? (
            <PanelRightClose className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <PanelLeftClose className="h-5 w-5 shrink-0" aria-hidden />
          )}
        </button>
      }
    >
      <SidebarLayoutProvider layoutCollapsed={layoutCollapsed}>
        <CollapsibleNavSection
          sectionKey="billing"
          title={t("platformBilling")}
          icon={CreditCard}
          sectionActive={pathname.startsWith("/billing")}
        >
          <SideNavItem
            href="/billing/pricing"
            label={t("platformBillingModules")}
            isActive={
              pathname.startsWith("/billing/pricing") &&
              !pathname.startsWith("/billing/pricing/addons")
            }
            icon={Tags}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/pricing/addons"
            label={t("platformBillingAddons")}
            isActive={pathname.startsWith("/billing/pricing/addons")}
            icon={Tags}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/quotas"
            label={t("platformBillingQuotas")}
            isActive={pathname.startsWith("/billing/quotas")}
            icon={Gauge}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/packages"
            label={t("platformBillingPackages")}
            isActive={pathname.startsWith("/billing/packages")}
            icon={Package}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/trial-allowlist"
            label={t("platformTrialAllowlist")}
            isActive={pathname.startsWith("/billing/trial-allowlist")}
            icon={CalendarClock}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/billing/settings"
            label={t("platformBillingSettings")}
            isActive={pathname.startsWith("/billing/settings")}
            icon={Settings}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        <SideNavItem
          href="/orgs"
          label={t("platformOrgs")}
          isActive={pathname.startsWith("/orgs")}
          icon={Building2}
          onNavClick={onNavClick}
        />

        <CollapsibleNavSection
          sectionKey="mdm"
          title={t("platformMdm")}
          icon={Database}
          sectionActive={pathname.startsWith("/mdm")}
        >
          <SideNavItem
            href="/mdm"
            label={t("platformMdmOverview")}
            isActive={pathname === "/mdm"}
            icon={Database}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/mdm/companies"
            label={t("platformMdmCompanies")}
            isActive={pathname.startsWith("/mdm/companies")}
            icon={Building2}
            nested
            onNavClick={onNavClick}
          />
          <SideNavItem
            href="/mdm/persons"
            label={t("platformMdmPersons")}
            isActive={pathname.startsWith("/mdm/persons")}
            icon={Users}
            nested
            onNavClick={onNavClick}
          />
        </CollapsibleNavSection>

        <SideNavItem
          href="/reference"
          label={t("platformReference")}
          isActive={pathname.startsWith("/reference")}
          icon={Library}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/early-access"
          label={t("platformEarlyAccess")}
          isActive={pathname.startsWith("/early-access")}
          icon={Sparkles}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/referrals"
          label={t("platformReferrals")}
          isActive={pathname.startsWith("/referrals")}
          icon={Users}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/landing"
          label={t("platformLanding")}
          isActive={pathname.startsWith("/landing")}
          icon={Tags}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/security"
          label={t("platformSecurity")}
          isActive={pathname.startsWith("/security")}
          icon={ShieldAlert}
          onNavClick={onNavClick}
        />
        <SideNavItem
          href="/vendors/channex"
          label={t("platformChannex")}
          isActive={pathname.startsWith("/vendors/channex")}
          icon={Radio}
          onNavClick={onNavClick}
        />
      </SidebarLayoutProvider>
    </EraAppSidebar>
  );
}
`,
);

write(
  path.join(dest, "components/layout/platform-header.tsx"),
  `"use client";

import { useTranslations } from "next-intl";
import {
  EraAppHeader,
  HeaderProfileMenu,
} from "@era/satellite-kit/ui";
import { OrchLanguageSwitcher } from "../locale/orch-language-switcher";
import type { OrchUser } from "@/lib/auth-context";

export function PlatformHeader({
  onToggleMobileNav,
  mobileNavOpen,
  sidebarCollapsed,
  ready,
  token,
  user,
  onLogout,
}: {
  onToggleMobileNav: () => void;
  mobileNavOpen: boolean;
  sidebarCollapsed?: boolean;
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  onLogout: () => void | Promise<void>;
}) {
  const t = useTranslations("nav");
  const displayName = user?.email?.trim() ?? "";

  return (
    <EraAppHeader
      sidebarCollapsed={sidebarCollapsed}
      mobileNavOpen={mobileNavOpen}
      onToggleMobileNav={onToggleMobileNav}
      profile={
        ready && token && user ? (
          <HeaderProfileMenu
            displayName={displayName}
            email={user.email}
            items={[]}
            onLogout={() => void onLogout()}
            logoutLabel={t("logout")}
            menuAriaLabel={t("profileMenuAria")}
          />
        ) : null
      }
      locale={<OrchLanguageSwitcher />}
    />
  );
}
`,
);

write(
  path.join(dest, "components/platform-shell.tsx"),
  `"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  APP_MAIN_CONTENT_CLASS,
  EraAppShellLayout,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { PlatformHeader } from "./layout/platform-header";
import { PlatformSidebar } from "./layout/platform-sidebar";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { ready, token, user, logout } = useAuth();
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsed());
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarReady) return;
    writeSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed, sidebarReady]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  if (isLogin || !token) {
    return <>{children}</>;
  }

  return (
    <EraAppShellLayout
      mobileNavOpen={mobileNavOpen}
      sidebarCollapsed={sidebarCollapsed}
      onCloseMobileNav={closeMobileNav}
      sidebar={
        <PlatformSidebar
          mobileNavOpen={mobileNavOpen}
          onNavClick={closeMobileNav}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      }
      header={
        <PlatformHeader
          onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
          mobileNavOpen={mobileNavOpen}
          sidebarCollapsed={sidebarCollapsed}
          ready={ready}
          token={token}
          user={user}
          onLogout={() => {
            logout();
            window.location.replace("/login");
          }}
        />
      }
    >
      <main className={APP_MAIN_CONTENT_CLASS}>{children}</main>
    </EraAppShellLayout>
  );
}
`,
);

write(
  path.join(dest, "components/app-providers.tsx"),
  `"use client";

import type { ReactNode } from "react";
import { EraToastProvider } from "@era/satellite-kit/ui";
import { AuthProvider } from "@/lib/auth-context";
import { PlatformShell } from "./platform-shell";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EraToastProvider />
      <PlatformShell>{children}</PlatformShell>
    </AuthProvider>
  );
}
`,
);

// --- app layout / login / pages ---
write(
  path.join(dest, "app/layout.tsx"),
  `import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { APP_SHELL_CLASS } from "@era/satellite-kit/ui";
import { AppProviders } from "../components/app-providers";
import "./globals.css";

export const dynamic = "force-dynamic";

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
      <body className={APP_SHELL_CLASS} style={{ margin: 0 }}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
`,
);

write(
  path.join(dest, "app/login/page.tsx"),
  `"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { AuthLoginCard, buildAuthLoginLabels, parseApiError } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";
import { OrchLanguageSwitcher } from "@/components/locale/orch-language-switcher";
import { useAuth, type OrchUser } from "@/lib/auth-context";
import { clearOrchTokens, orchFetch } from "@/lib/orch-api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const { login, token, ready, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("reason") === "expired") {
      setError(tAuth("sessionExpired"));
    }
  }, [searchParams, tAuth]);

  useEffect(() => {
    if (!ready || !token) return;
    if (user?.isSuperAdmin) {
      router.replace("/");
    }
  }, [ready, token, user, router]);

  if (ready && token && user?.isSuperAdmin) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), tAuth("loginFailed")));
        return;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        user: { id: string; email: string; organizationId?: string | null };
        claims?: { isSuperAdmin?: boolean; role?: string };
      };
      const claims =
        data.claims ??
        (() => {
          try {
            return JSON.parse(atob(data.accessToken.split(".")[1] ?? "")) as {
              isSuperAdmin?: boolean;
              role?: string;
            };
          } catch {
            return {};
          }
        })();
      if (!claims.isSuperAdmin) {
        clearOrchTokens();
        setError(tAuth("operatorOnly"));
        return;
      }
      const nextUser: OrchUser = {
        id: data.user.id,
        email: data.user.email,
        organizationId: data.user.organizationId ?? null,
        role: claims.role ?? null,
        isSuperAdmin: true,
      };
      login(data.accessToken, nextUser, data.refreshToken);
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLoginCard
      locale={locale}
      localeControl={<OrchLanguageSwitcher />}
      labels={buildAuthLoginLabels(tAuth, { emailMode: true })}
      loginId={email}
      password={password}
      onLoginIdChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      error={error ?? undefined}
      emailMode
      legalAppPrefix="ERA365"
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
`,
);

write(
  path.join(dest, "app/(console)/layout.tsx"),
  `"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, user, token } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token || !user?.isSuperAdmin) {
      router.replace("/login");
    }
  }, [ready, token, user, router]);

  if (!ready || !token || !user?.isSuperAdmin) return null;
  return <>{children}</>;
}
`,
);

// Copy all super-admin pages into app/(console)/ with short paths
const saRoot = path.join(srcWeb, "app/super-admin");
walkCopyPages(saRoot, path.join(dest, "app/(console)"));

// Fix root redirect page (was redirect to /billing/pricing after rewrite)
write(
  path.join(dest, "app/(console)/page.tsx"),
  `import { redirect } from "next/navigation";

export default function PlatformHomePage() {
  redirect("/billing/pricing");
}
`,
);

write(
  path.join(dest, "app/(console)/billing/page.tsx"),
  `import { redirect } from "next/navigation";

export default function BillingIndex() {
  redirect("/billing/pricing");
}
`,
);

// Remove the old super-admin layout that checked isSuperAdmin via relative import — already copied as layout.tsx under (console) from sa layout
// Replace it with our console layout already written — walkCopyPages may have overwritten with old layout
write(
  path.join(dest, "app/(console)/layout.tsx"),
  `"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, user, token } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token || !user?.isSuperAdmin) {
      router.replace("/login");
    }
  }, [ready, token, user, router]);

  if (!ready || !token || !user?.isSuperAdmin) return null;
  return <>{children}</>;
}
`,
);

// API routes
copyFile(
  path.join(srcWeb, "app/api/cp-admin/[[...path]]/route.ts"),
  path.join(dest, "app/api/cp-admin/[[...path]]/route.ts"),
);
// Fix import path in copied route
{
  const p = path.join(dest, "app/api/cp-admin/[[...path]]/route.ts");
  let c = read(p);
  c = c.replace(
    'from "../../../../lib/orch-api"',
    'from "@/lib/orch-api"',
  );
  write(p, c);
}
copyFile(
  path.join(srcWeb, "app/api/locale/route.ts"),
  path.join(dest, "app/api/locale/route.ts"),
);

console.log("platform-web scaffolded at", dest);
