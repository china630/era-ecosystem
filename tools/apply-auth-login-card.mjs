#!/usr/bin/env node
/** Apply AuthLoginCard login page, /help public middleware, and credential login API to industry satellites. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SATELLITES = [
  "era-orchestrator",
  "era-retail-pos",
  "era-fnb-pos",
  "era-wholesale",
  "era-clinic",
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
];

const LOGIN_PAGE = `"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AuthLoginCard } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginId, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : tAuth("loginFailed"));
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  let subtitle: string | undefined;
  let ssoHint: string | undefined;
  try {
    subtitle = t("subtitle");
  } catch {
    subtitle = undefined;
  }
  try {
    ssoHint = t("ssoHint") || t("demoHint");
  } catch {
    ssoHint = undefined;
  }

  return (
    <AuthLoginCard
      locale={locale}
      labels={{
        loginTitle: tAuth("loginTitle"),
        loginId: tAuth("loginId"),
        password: tAuth("password"),
        submitLogin: tAuth("submitLogin"),
        submitBusy: tAuth("submitBusy"),
        needAccount: tAuth("needAccount"),
        registerOrgLink: tAuth("registerOrgLink"),
        viewPricing: tAuth("viewPricing"),
        userAgreement: tAuth("userAgreement"),
        footerLegalNavAria: tAuth("footerLegalNavAria"),
        footerFaq: tAuth("footerFaq"),
        footerTerms: tAuth("footerTerms"),
        footerPrivacy: tAuth("footerPrivacy"),
        footerStatus: tAuth("footerStatus"),
      }}
      loginId={loginId}
      password={password}
      onLoginIdChange={setLoginId}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      error={error || undefined}
      subtitle={subtitle}
      ssoHint={ssoHint}
    />
  );
}
`;

const LOGIN_ROUTE = `import {
  authCookieName,
  findUserByCredential,
  isSatelliteUserLoginAllowed,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const schema = z.object({ login: z.string().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await findUserByCredential(prisma, body.login);
    if (!user || !isSatelliteUserLoginAllowed(user)) {
      return jsonError("Invalid credentials", 401);
    }
    const valid = await verifySatelliteUserPassword(body.password, user);
    if (!valid) {
      return jsonError("Invalid credentials", 401);
    }
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
    });
    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
      },
      token,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
`;

function patchMiddleware(file) {
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('pathname === "/help"')) {
    console.log("skip middleware (help already public):", file);
    return;
  }
  const needle = 'pathname === "/sso/callback"';
  if (!src.includes(needle)) {
    console.log("skip middleware (pattern not found):", file);
    return;
  }
  src = src.replace(
    needle,
    'pathname === "/sso/callback" || pathname === "/help" || pathname.startsWith("/help/")',
  );
  fs.writeFileSync(file, src, "utf8");
  console.log("patched middleware:", file);
}

function addPhoneToSchema(schemaFile) {
  if (!fs.existsSync(schemaFile)) return;
  let src = fs.readFileSync(schemaFile, "utf8");
  if (src.includes("phone")) {
    console.log("skip schema (phone exists):", schemaFile);
    return;
  }
  src = src.replace(
    /email\s+String\?\s*\n/,
    "email           String?\n  phone           String?   @unique\n",
  );
  fs.writeFileSync(schemaFile, src, "utf8");
  console.log("patched schema phone:", schemaFile);
}

for (const sat of SATELLITES) {
  const loginPage = path.join(root, sat, "app/login/page.tsx");
  if (fs.existsSync(loginPage)) {
    fs.writeFileSync(loginPage, LOGIN_PAGE, "utf8");
    console.log("wrote login page:", loginPage);
  }
  const loginRoute = path.join(root, sat, "app/api/auth/login/route.ts");
  if (fs.existsSync(loginRoute)) {
    fs.writeFileSync(loginRoute, LOGIN_ROUTE, "utf8");
    console.log("wrote login route:", loginRoute);
  }
  patchMiddleware(path.join(root, sat, "middleware.ts"));
  addPhoneToSchema(path.join(root, sat, "prisma/schema.prisma"));
}

console.log("done");
