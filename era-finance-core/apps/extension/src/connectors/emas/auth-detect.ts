import { EmasSelectors } from "./selectors";
import type { AuthState } from "../types";

export function detectEmasAuthState(doc: Document): AuthState {
  const text = doc.body?.innerText?.toLowerCase() ?? "";
  if (text.includes("asan") && text.includes("imza")) {
    /* likely login / signing page */
  }
  for (const sel of EmasSelectors.authIndicators) {
    try {
      if (doc.querySelector(sel)) return "authenticated";
    } catch {
      /* invalid selector */
    }
  }
  if (doc.querySelector("form")) return "anonymous";
  return "unknown";
}

/** First standalone 10-digit VÖEN in text — never concatenate all page digits. */
export function extractVoenFromText(raw: string): string | null {
  const groups = raw.match(/\d+/g) ?? [];
  for (const g of groups) {
    if (g.length === 10) return g;
  }
  return null;
}

export async function detectEmasActiveVoen(doc: Document): Promise<string | null> {
  for (const sel of EmasSelectors.activeVoenCandidates) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = doc.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const node of nodes) {
      const text = (node.textContent ?? "").trim();
      const voen = extractVoenFromText(text);
      if (voen) return voen;
    }
  }
  return extractVoenFromText(doc.body?.innerText ?? "");
}
