import type { EraOpsNavItem, EraOpsNavSection } from "./era-ops-types";

export type NavSearch = { get(name: string): string | null };

export function splitNavHref(href: string): { path: string; query: string; hash: string } {
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt + 1) : "";
  const bare = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const q = bare.indexOf("?");
  if (q < 0) return { path: bare || "/", query: "", hash };
  return { path: bare.slice(0, q) || "/", query: bare.slice(q + 1), hash };
}

/** True when this href is the current page or a prefix of it, including query pins and hash. */
export function navHrefMatches(
  pathname: string,
  search: NavSearch,
  href: string,
  currentHash = "",
): boolean {
  const { path, query, hash } = splitNavHref(href);
  const pathOk =
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathOk) return false;
  if (hash) {
    if (hash !== currentHash) return false;
  } else if (currentHash && pathname === path) {
    return false;
  }
  if (!query) return true;
  const want = new URLSearchParams(query);
  for (const [key, value] of want) {
    if (search.get(key) !== value) return false;
  }
  return true;
}

function navHrefScore(href: string): number {
  const { path, query, hash } = splitNavHref(href);
  return path.length + (query ? 10_000 + query.length : 0) + (hash ? 100 + hash.length : 0);
}

/** Longest matching href. A parent such as `/hk` loses to `/hk/maids`. */
export function bestMatchingNavHref(
  pathname: string,
  search: NavSearch,
  hrefs: readonly string[],
  currentHash = "",
): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const href of hrefs) {
    if (!href || !navHrefMatches(pathname, search, href, currentHash)) continue;
    const score = navHrefScore(href);
    if (score > bestScore) {
      bestScore = score;
      best = href;
    }
  }
  return best;
}

export function isBestNavHref(href: string | undefined, best: string | null): boolean {
  if (!href || !best) return false;
  const a = splitNavHref(href);
  const b = splitNavHref(best);
  return a.path === b.path && a.query === b.query && a.hash === b.hash;
}

export function collectNavHrefs(items: readonly EraOpsNavItem[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly EraOpsNavItem[]) => {
    for (const item of list) {
      if (item.hidden) continue;
      if (item.href) out.push(item.href);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(items);
  return out;
}

export function collectSectionHrefs(sections: readonly EraOpsNavSection[], topItems: readonly EraOpsNavItem[] = []): string[] {
  const fromSections = sections
    .filter((section) => !section.hidden)
    .flatMap((section) => collectNavHrefs(section.items));
  return [...fromSections, ...collectNavHrefs(topItems)];
}

const EMPTY_SEARCH: NavSearch = { get: () => null };

export function sectionContainsPath(
  section: EraOpsNavSection,
  pathname: string,
  search: NavSearch = EMPTY_SEARCH,
  currentHash = "",
): boolean {
  return collectNavHrefs(section.items).some((href) =>
    navHrefMatches(pathname, search, href, currentHash),
  );
}

/** True when this section owns the single best matching href (not a shorter prefix). */
export function sectionOwnsBestHref(
  section: EraOpsNavSection,
  bestHref: string | null,
): boolean {
  if (!bestHref) return false;
  return collectNavHrefs(section.items).some((href) => isBestNavHref(href, bestHref));
}
