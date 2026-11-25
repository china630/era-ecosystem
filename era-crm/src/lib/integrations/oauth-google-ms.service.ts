/**
 * Google + Microsoft OAuth for mail/calendar (TZ T-I24 / T-I28).
 * Platform ENV: GOOGLE_OAUTH_CLIENT_ID/SECRET, MICROSOFT_OAUTH_CLIENT_ID/SECRET, PUBLIC_BASE_URL.
 */
import { createHttpClient, encryptSecretsJson } from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";

type Provider = "google" | "microsoft";

function publicBase(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:23207").replace(/\/$/, "");
}

export function oauthRedirectUri(): string {
  return `${publicBase()}/admin/integrations/oauth/callback`;
}

export function googleCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function microsoftCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function withQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export function buildGoogleOAuthUrl(input: {
  connectionId: string;
  organizationId: string;
  scopes: string[];
}): string {
  const creds = googleCreds();
  if (!creds) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
  const state = Buffer.from(
    JSON.stringify({
      provider: "google",
      connectionId: input.connectionId,
      organizationId: input.organizationId,
      t: Date.now(),
    }),
  ).toString("base64url");
  return withQuery("https://accounts.google.com/o/oauth2/v2/auth", {
    client_id: creds.clientId,
    redirect_uri: oauthRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: input.scopes.join(" "),
    state,
  });
}

export function buildMicrosoftOAuthUrl(input: {
  connectionId: string;
  organizationId: string;
  scopes: string[];
}): string {
  const creds = microsoftCreds();
  if (!creds) throw new Error("MICROSOFT_OAUTH_CLIENT_ID/SECRET not configured");
  const state = Buffer.from(
    JSON.stringify({
      provider: "microsoft",
      connectionId: input.connectionId,
      organizationId: input.organizationId,
      t: Date.now(),
    }),
  ).toString("base64url");
  return withQuery(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    {
      client_id: creds.clientId,
      redirect_uri: oauthRedirectUri(),
      response_type: "code",
      response_mode: "query",
      scope: [...input.scopes, "offline_access"].join(" "),
      state,
    },
  );
}

export async function completeGoogleOrMsOAuth(input: {
  code: string;
  state: string;
  organizationId: string;
}): Promise<{ connectionId: string; provider: Provider }> {
  let parsed: {
    provider?: Provider;
    connectionId?: string;
    organizationId?: string;
  };
  try {
    parsed = JSON.parse(
      Buffer.from(input.state, "base64url").toString("utf8"),
    ) as typeof parsed;
  } catch {
    throw new Error("invalid OAuth state");
  }
  if (
    !parsed.connectionId ||
    parsed.organizationId !== input.organizationId ||
    (parsed.provider !== "google" && parsed.provider !== "microsoft")
  ) {
    throw new Error("OAuth state mismatch");
  }
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: parsed.connectionId, organizationId: input.organizationId },
  });
  if (!connection) throw new Error("connection not found");

  const http = createHttpClient();
  let accessToken = "";
  let refreshToken = "";
  let expiresIn = 0;

  if (parsed.provider === "google") {
    const creds = googleCreds();
    if (!creds) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
    const res = await http.request({
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: oauthRedirectUri(),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (res.status >= 300) throw new Error(`Google token failed: ${res.text}`);
    const json = res.json as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    accessToken = String(json.access_token ?? "");
    refreshToken = String(json.refresh_token ?? "");
    expiresIn = Number(json.expires_in ?? 0);
  } else {
    const creds = microsoftCreds();
    if (!creds) throw new Error("MICROSOFT_OAUTH_CLIENT_ID/SECRET not configured");
    const res = await http.request({
      method: "POST",
      url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: oauthRedirectUri(),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (res.status >= 300) throw new Error(`Microsoft token failed: ${res.text}`);
    const json = res.json as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    accessToken = String(json.access_token ?? "");
    refreshToken = String(json.refresh_token ?? "");
    expiresIn = Number(json.expires_in ?? 0);
  }

  if (!accessToken) throw new Error("no access_token");
  const existing = resolveSecrets(connection);
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      secretsEnc: encryptSecretsJson({
        ...existing,
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
      }),
      oauthExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
      status: "ACTIVE",
      lastError: null,
    },
  });
  return { connectionId: connection.id, provider: parsed.provider };
}

/** Renew OAuth access tokens that expire within 30 minutes. */
export async function renewExpiringOAuthTokens(): Promise<number> {
  const soon = new Date(Date.now() + 30 * 60_000);
  const rows = await prisma.integrationConnection.findMany({
    where: {
      enabled: true,
      providerKey: {
        in: ["gmail_api", "ms_graph_mail", "gcal", "ms365_calendar"],
      },
      oauthExpiresAt: { lte: soon },
    },
    take: 50,
  });
  const http = createHttpClient();
  let n = 0;
  for (const row of rows) {
    const secrets = resolveSecrets(row);
    const refresh = secrets.refreshToken;
    if (!refresh) continue;
    try {
      if (row.providerKey === "gmail_api" || row.providerKey === "gcal") {
        const creds = googleCreds();
        if (!creds) continue;
        const res = await http.request({
          method: "POST",
          url: "https://oauth2.googleapis.com/token",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            refresh_token: refresh,
            grant_type: "refresh_token",
          }).toString(),
        });
        if (res.status >= 300) throw new Error(res.text);
        const json = res.json as { access_token?: string; expires_in?: number };
        await prisma.integrationConnection.update({
          where: { id: row.id },
          data: {
            secretsEnc: encryptSecretsJson({
              ...secrets,
              accessToken: String(json.access_token ?? secrets.accessToken),
            }),
            oauthExpiresAt: json.expires_in
              ? new Date(Date.now() + Number(json.expires_in) * 1000)
              : row.oauthExpiresAt,
            lastError: null,
          },
        });
        n += 1;
      } else {
        const creds = microsoftCreds();
        if (!creds) continue;
        const res = await http.request({
          method: "POST",
          url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            refresh_token: refresh,
            grant_type: "refresh_token",
            scope: "offline_access",
          }).toString(),
        });
        if (res.status >= 300) throw new Error(res.text);
        const json = res.json as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        await prisma.integrationConnection.update({
          where: { id: row.id },
          data: {
            secretsEnc: encryptSecretsJson({
              ...secrets,
              accessToken: String(json.access_token ?? secrets.accessToken),
              ...(json.refresh_token
                ? { refreshToken: String(json.refresh_token) }
                : {}),
            }),
            oauthExpiresAt: json.expires_in
              ? new Date(Date.now() + Number(json.expires_in) * 1000)
              : row.oauthExpiresAt,
            lastError: null,
          },
        });
        n += 1;
      }
    } catch (err) {
      await prisma.integrationConnection.update({
        where: { id: row.id },
        data: {
          lastError: err instanceof Error ? err.message : String(err),
          status: "ERROR",
        },
      });
    }
  }
  return n;
}
