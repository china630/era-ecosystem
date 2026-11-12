/** Role grant missing. Business 403s (care team, closed day, module off) use their own codes. */
export const ROLE_FORBIDDEN_CODE = "FORBIDDEN";

/** Staff page shown when a signed-in session lacks the screen grant. */
export const STAFF_ACCESS_DENIED_PATH = "/access-denied";

export function roleForbiddenBody(message = "Forbidden"): {
  error: string;
  code: typeof ROLE_FORBIDDEN_CODE;
} {
  return { error: message, code: ROLE_FORBIDDEN_CODE };
}

export function isRoleForbiddenPayload(record: {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}): boolean {
  if (record.code === ROLE_FORBIDDEN_CODE) return true;
  const text =
    typeof record.error === "string"
      ? record.error
      : typeof record.message === "string"
        ? record.message
        : "";
  return text.trim() === "Forbidden: insufficient permissions";
}
