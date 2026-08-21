export const OPEN_API_PERMISSIONS = [
  { value: "accounts:read", label: "accounts:read" },
  { value: "payments:read", label: "payments:read" },
  { value: "payments:create", label: "payments:create" },
  { value: "payments:submit", label: "payments:submit" },
] as const;

export type OpenApiPermission = (typeof OPEN_API_PERMISSIONS)[number]["value"];

export function isOpenApiPermission(value: string): value is OpenApiPermission {
  return OPEN_API_PERMISSIONS.some((p) => p.value === value);
}
