/**
 * Meta OAuth helpers for Instagram / Messenger page tokens (TZ T-I12).
 * Platform ENV only: META_APP_ID, META_APP_SECRET, PUBLIC_BASE_URL.
 */
import { createHttpClient, encryptSecretsJson } from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaAppCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID?.trim() ?? "";
  const appSecret = process.env.META_APP_SECRET?.trim() ?? "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function metaOAuthRedirectUri(): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:23207").replace(
    /\/$/,
    "",
  );
  return `${base}/admin/integrations/oauth/callback`;
}

export function buildMetaOAuthUrl(input: {
  connectionId: string;
  organizationId: string;
  scopes?: string[];
}): string {
  const creds = metaAppCredentials();
  if (!creds) throw new Error("META_APP_ID / META_APP_SECRET not configured");
  const state = Buffer.from(
    JSON.stringify({
      connectionId: input.connectionId,
      organizationId: input.organizationId,
      t: Date.now(),
    }),
  ).toString("base64url");
  const scopes = (
    input.scopes ?? [
      "pages_show_list",
      "pages_messaging",
      "instagram_basic",
      "instagram_manage_messages",
      "pages_manage_metadata",
    ]
  ).join(",");
  const dialog = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  dialog.searchParams.set("client_id", creds.appId);
  dialog.searchParams.set("redirect_uri", metaOAuthRedirectUri());
  dialog.searchParams.set("state", state);
  dialog.searchParams.set("scope", scopes);
  dialog.searchParams.set("response_type", "code");
  return dialog.toString();
}

function withQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export async function completeMetaOAuth(input: {
  code: string;
  state: string;
  organizationId: string;
}): Promise<{ connectionId: string; pageName?: string }> {
  const creds = metaAppCredentials();
  if (!creds) throw new Error("META_APP_ID / META_APP_SECRET not configured");
  let parsed: { connectionId?: string; organizationId?: string };
  try {
    parsed = JSON.parse(
      Buffer.from(input.state, "base64url").toString("utf8"),
    ) as {
      connectionId?: string;
      organizationId?: string;
    };
  } catch {
    throw new Error("invalid OAuth state");
  }
  if (!parsed.connectionId || parsed.organizationId !== input.organizationId) {
    throw new Error("OAuth state mismatch");
  }
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      id: parsed.connectionId,
      organizationId: input.organizationId,
    },
  });
  if (!connection) throw new Error("connection not found");

  const http = createHttpClient();
  const tokenRes = await http.request({
    method: "GET",
    url: withQuery(`${GRAPH}/oauth/access_token`, {
      client_id: creds.appId,
      client_secret: creds.appSecret,
      redirect_uri: metaOAuthRedirectUri(),
      code: input.code,
    }),
  });
  if (tokenRes.status >= 300) {
    throw new Error(`token exchange failed: ${tokenRes.text}`);
  }
  const short = tokenRes.json as { access_token?: string; expires_in?: number };
  if (!short.access_token) throw new Error("no access_token from Meta");

  const longRes = await http.request({
    method: "GET",
    url: withQuery(`${GRAPH}/oauth/access_token`, {
      grant_type: "fb_exchange_token",
      client_id: creds.appId,
      client_secret: creds.appSecret,
      fb_exchange_token: short.access_token,
    }),
  });
  const longTok =
    longRes.status < 300
      ? String(
          (longRes.json as { access_token?: string }).access_token ??
            short.access_token,
        )
      : short.access_token;
  const expiresIn =
    longRes.status < 300
      ? Number(
          (longRes.json as { expires_in?: number }).expires_in ??
            short.expires_in ??
            0,
        )
      : Number(short.expires_in ?? 0);

  const pagesRes = await http.request({
    method: "GET",
    url: `${GRAPH}/me/accounts`,
    headers: { Authorization: `Bearer ${longTok}` },
  });
  if (pagesRes.status >= 300) {
    throw new Error(`pages list failed: ${pagesRes.text}`);
  }
  const pages = ((
    pagesRes.json as {
      data?: Array<{ id: string; name?: string; access_token?: string }>;
    }
  ).data ?? []) as Array<{ id: string; name?: string; access_token?: string }>;
  const page = pages[0];
  if (!page?.access_token) throw new Error("no Facebook Page linked to this user");

  const existing = resolveSecrets(connection);
  const secrets = {
    ...existing,
    accessToken: page.access_token,
    appSecret: creds.appSecret,
  };
  const config = {
    ...JSON.parse(connection.configJson || "{}"),
    pageId: page.id,
    pageName: page.name ?? "",
    graphVersion: "v21.0",
  };
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      secretsEnc: encryptSecretsJson(secrets),
      configJson: JSON.stringify(config),
      oauthExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
      status: "ACTIVE",
      lastError: null,
    },
  });
  return { connectionId: connection.id, pageName: page.name };
}

const META_OAUTH_PROVIDER_KEYS = new Set([
  "instagram",
  "fb_messenger",
  "messenger",
  "meta_lead_ads",
]);

/** Re-exchange long-lived token via Graph v21 before expiry (T-I12). */
export async function refreshMetaConnectionToken(
  connectionId: string,
  organizationId: string,
): Promise<{ connectionId: string; oauthExpiresAt: string | null }> {
  const creds = metaAppCredentials();
  if (!creds) throw new Error("META_APP_ID / META_APP_SECRET not configured");

  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organizationId },
  });
  if (!connection) throw new Error("connection not found");
  if (!META_OAUTH_PROVIDER_KEYS.has(connection.providerKey)) {
    throw new Error("not a Meta OAuth connection");
  }

  const secrets = resolveSecrets(connection);
  const existingToken = secrets.accessToken?.trim();
  if (!existingToken) throw new Error("no accessToken to refresh");

  const http = createHttpClient();
  const longRes = await http.request({
    method: "GET",
    url: withQuery(`${GRAPH}/oauth/access_token`, {
      grant_type: "fb_exchange_token",
      client_id: creds.appId,
      client_secret: creds.appSecret,
      fb_exchange_token: existingToken,
    }),
  });
  if (longRes.status >= 300) {
    throw new Error(`token refresh failed: ${longRes.text}`);
  }
  const body = longRes.json as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("no access_token from Meta refresh");

  const expiresIn = Number(body.expires_in ?? 0);
  const oauthExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  const nextSecrets = { ...secrets, accessToken: body.access_token };
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      secretsEnc: encryptSecretsJson(nextSecrets),
      oauthExpiresAt,
      status: "ACTIVE",
      lastError: null,
    },
  });

  return {
    connectionId: connection.id,
    oauthExpiresAt: oauthExpiresAt?.toISOString() ?? null,
  };
}
