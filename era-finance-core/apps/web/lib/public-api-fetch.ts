import { resolveApiUrl } from "./api-client";

/** Запрос к публичным эндпоинтам API без редиректа на /login при 401. */
export function publicApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(resolveApiUrl(path), { ...init });
}
