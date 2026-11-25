/** Shared Nest ALS frame mock for staff-session unit tests (no next/headers). */

export const nestFrameHeaders: Record<string, string | null> = {};

jest.mock("@/lib/nest-http-context", () => ({
  nestHttpFrame: jest.fn(() => ({
    cookies: { get: () => undefined },
    headers: {
      get: (name: string) =>
        nestFrameHeaders[name] ??
        (name === "x-era-pathname" ? "/api/auth/me" : null),
    },
  })),
  runWithNestHttp: jest.fn((_req: unknown, fn: () => Promise<unknown>) => fn()),
}));

export function resetNestFrameHeaders(): void {
  for (const k of Object.keys(nestFrameHeaders)) delete nestFrameHeaders[k];
}
