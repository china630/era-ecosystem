/** `*` matches one path segment; a trailing `**` matches the rest, including nothing. */
export function matchRoutePattern(pattern: string, pathname: string): boolean {
  const want = pattern.split("/").filter(Boolean);
  const have = (pathname.split("?")[0] ?? "").split("/").filter(Boolean);
  for (let i = 0; i < want.length; i++) {
    if (want[i] === "**") return true;
    if (i >= have.length) return false;
    if (want[i] !== "*" && want[i] !== have[i]) return false;
  }
  return want.length === have.length;
}

export type RouteRule<T> = readonly [pattern: string, value: T];

/** First matching rule wins. */
export function firstRouteMatch<T>(rules: readonly RouteRule<T>[], pathname: string): T | null {
  for (const [pattern, value] of rules) {
    if (matchRoutePattern(pattern, pathname)) return value;
  }
  return null;
}

export function matchesAnyRoute(patterns: readonly string[], pathname: string): boolean {
  return patterns.some((p) => matchRoutePattern(p, pathname));
}
