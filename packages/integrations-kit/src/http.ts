import { redactForLog } from "./crypto";
import type { HttpClient } from "./types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createHttpClient(opts?: {
  timeoutMs?: number;
  maxRetries?: number;
}): HttpClient {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const maxRetries = opts?.maxRetries ?? 3;
  return {
    async request({ method, url, headers, body }) {
      let lastStatus = 0;
      let lastText = "";
      let lastJson: unknown = null;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            method,
            headers: {
              "content-type": "application/json",
              ...(headers ?? {}),
            },
            body:
              body === undefined
                ? undefined
                : typeof body === "string"
                  ? body
                  : JSON.stringify(body),
            signal: ctrl.signal,
          });
          const text = await res.text();
          let json: unknown = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          lastStatus = res.status;
          lastText = text;
          lastJson = json;
          if (res.status === 429 || res.status >= 500) {
            void redactForLog({ url, status: res.status, attempt });
            if (attempt < maxRetries) {
              const retryAfter = Number(res.headers.get("retry-after") ?? 0);
              const backoff = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
              await sleep(backoff);
              continue;
            }
          }
          return { status: res.status, json, text };
        } finally {
          clearTimeout(t);
        }
      }
      return { status: lastStatus, json: lastJson, text: lastText };
    },
  };
}
