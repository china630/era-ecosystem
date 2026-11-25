/** Client fetch helper — surfaces FORBIDDEN / 403 as readable copy. */

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

export async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(input, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const errObj = body && typeof body === "object" ? (body as { error?: string; code?: string }) : null;
    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: errObj?.error?.trim() || "FORBIDDEN — missing permission for this action",
      };
    }
    return {
      ok: false,
      status: res.status,
      error: errObj?.error?.trim() || `Request failed (${res.status})`,
    };
  }
  return { ok: true, status: res.status, data: body as T };
}
