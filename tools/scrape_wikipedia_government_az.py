#!/usr/bin/env python3
"""Scrape state organizations from az.wikipedia.org (recursive via MediaWiki API)."""

from __future__ import annotations

import csv
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "government"
CACHE_DIR = OUT_DIR / ".cache" / "wiki-categories"
WIKI_BASE = "https://az.wikipedia.org"
API_URL = f"{WIKI_BASE}/w/api.php"
ROOT_CATEGORY = "Kateqoriya:Azərbaycanın dövlət təşkilatları"
ROOT_CATEGORY_URL = f"{WIKI_BASE}/wiki/{urllib.parse.quote(ROOT_CATEGORY.replace(' ', '_'))}"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
DELAY_SEC = 0.5
MAX_RETRIES = 8


def api_get(params: dict) -> dict:
    params = {**params, "format": "json"}
    url = API_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "az"})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            last_err = err
            if err.code == 429:
                time.sleep(min(120, 5 * (2**attempt)))
                continue
            raise
        except Exception as err:
            last_err = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"API failed after retries: {last_err}")


def cache_path(category_title: str) -> Path:
    safe = re.sub(r"[^\w.-]+", "_", category_title)[:160]
    return CACHE_DIR / f"{safe}.json"


def category_members_fetch(category_title: str) -> tuple[list[dict], list[str]]:
    pages: list[dict] = []
    subcats: list[str] = []
    continue_token: str | None = None
    while True:
        params: dict = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category_title,
            "cmtype": "page|subcat",
            "cmlimit": "500",
        }
        if continue_token:
            params["cmcontinue"] = continue_token
        data = api_get(params)
        time.sleep(DELAY_SEC)
        batch = data.get("query", {}).get("categorymembers", [])
        for item in batch:
            ns = item.get("ns", 0)
            title = item.get("title", "")
            if ns == 14:
                subcats.append(title)
            elif ns == 0:
                pages.append(item)
        cont = data.get("continue", {})
        continue_token = cont.get("cmcontinue")
        if not continue_token:
            break
    return pages, subcats


def category_members(category_title: str) -> tuple[list[dict], list[str]]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = cache_path(category_title)
    if path.exists():
        cached = json.loads(path.read_text(encoding="utf-8"))
        return cached["pages"], cached["subcats"]
    pages, subcats = category_members_fetch(category_title)
    path.write_text(
        json.dumps({"pages": pages, "subcats": subcats}, ensure_ascii=False),
        encoding="utf-8",
    )
    return pages, subcats


def title_to_name(title: str) -> str:
    return title


def wiki_article_url(title: str) -> str:
    return f"{WIKI_BASE}/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"


def category_display(title: str) -> str:
    return title.removeprefix("Kateqoriya:")


def infer_org_kind(name: str) -> str:
    n = name.lower()
    rules = [
        (r"agentliyi", "agency"),
        (r"dövlət xidməti|xidməti", "state_service"),
        (r"fondu", "fund"),
        (r"komissiya", "commission"),
        (r"mərkəzi", "center"),
        (r"birliyi", "public_entity"),
        (r"məhkəməsi", "court"),
        (r"nazirliyi", "ministry"),
        (r"şura", "council"),
        (r"palatası", "chamber"),
        (r"lotereya", "lottery"),
        (r"asan", "public_service_center"),
        (r"prokurorluğu", "prosecution"),
        (r"seçki komissiyası", "election_commission"),
        (r"gəmiçiliyi", "shipping"),
        (r"idarəsi$", "directorate"),
        (r"komitəsi", "committee"),
    ]
    for pattern, kind in rules:
        if re.search(pattern, n):
            return kind
    return "state_body"


# --- Institution-only filters (exclude ministers, police biographies, etc.) ---

BIO_SUBCATEGORY_RE = re.compile(
    r"(?:"
    r"nazirləri|naziri|müavinləri|rəisləri|məzunları|polisləri|deputatları|"
    r"şəxsləri|generalları|admiralları|hərbçiləri|hakimləri|prokurorları|"
    r"müşahidləri|vətəndaşları|aktyorları|rəssamları|şairləri|müğənniləri"
    r")$",
    re.I,
)

SKIP_SUBCATEGORY_NAMES = {
    "Azərbaycan polisləri",
    "Azərbaycan Respublikasının nazirləri",
    "Azərbaycan Respublikasının nazir müavinləri",
    "Azərbaycan hüquq mühafizə orqanları",
    "Azərbaycanda polis",
    "Milli Məclis (Azərbaycan)",
    "Azərbaycan Respublikasının Müdafiə Şurası",
}

PERSON_TITLE_RE = re.compile(r"\b(?:oğlu|qızı)\b", re.I)

INSTITUTION_TITLE_RE = re.compile(
    r"agentliyi|agentlik|xidməti|xidmət|fondu|komissiyası|komissiya|mərkəzi|"
    r"birliyi|idarəsi|nazirliyi|şurası|palatası|məhkəməsi|akademiyası|"
    r"universiteti|təşkilatı|müəssisəsi|komitəsi|gəmiçiliyi|lotereya|"
    r"prokurorluğu|arxiv|auditor|assosiasiya|institutu|klinikası|xəstəxanası|"
    r"telekom|keçid|mərkəz|federasiya|korporasiya|şirkəti|"
    r"respublikası|dövlət|kabineti|kollegiyası|məclisi|naxçıvan",
    re.I,
)


def is_biographical_category_name(name: str) -> bool:
    if name in SKIP_SUBCATEGORY_NAMES:
        return True
    return bool(BIO_SUBCATEGORY_RE.search(name.strip()))


def is_biographical_category_path(path: str) -> bool:
    return any(is_biographical_category_name(segment) for segment in path.split(" > "))


def is_organization_article(title: str, category_path: str) -> bool:
    if is_biographical_category_path(category_path):
        return False
    if PERSON_TITLE_RE.search(title):
        return False
    if INSTITUTION_TITLE_RE.search(title):
        return True
    return False


def should_skip_subcategory(cat_title: str) -> bool:
    return is_biographical_category_name(category_display(cat_title))


def crawl(root_category: str) -> tuple[list[dict], list[dict], dict]:
    queue: deque[tuple[str, str]] = deque()
    root_path = category_display(root_category)
    queue.append((root_category, root_path))

    visited: set[str] = set()
    organizations: dict[str, dict] = {}
    meta = {
        "categories_visited": 0,
        "api_calls": 0,
        "subcategories_skipped": 0,
        "articles_skipped": 0,
    }

    while queue:
        cat_title, path = queue.popleft()
        if cat_title in visited:
            continue
        visited.add(cat_title)

        pages, subcats = category_members(cat_title)
        if not cache_path(cat_title).exists():
            meta["api_calls"] += 1
        meta["categories_visited"] += 1
        if meta["categories_visited"] % 10 == 0:
            print(
                f"  categories {meta['categories_visited']}, "
                f"orgs {len(organizations)}, queue {len(queue)}",
                flush=True,
            )

        cat_url = wiki_article_url(cat_title)

        for page in pages:
            title = page.get("title", "")
            if not title or title.startswith(("Şablon:", "Vikipediya:", "Kömək:")):
                continue
            if not is_organization_article(title, path):
                meta["articles_skipped"] += 1
                continue
            url = wiki_article_url(title)
            row = {
                "name": title_to_name(title),
                "entry_type": "organization",
                "letter_group": "",
                "org_kind": infer_org_kind(title),
                "wikipedia_url": url,
                "category_path": path,
                "found_in_category_url": cat_url,
                "source": "az.wikipedia.org",
                "source_url": ROOT_CATEGORY_URL,
            }
            if url in organizations:
                organizations[url].setdefault("_paths", set()).add(path)
            else:
                row["_paths"] = {path}
                organizations[url] = row

        for sub in subcats:
            if sub in visited or should_skip_subcategory(sub):
                if should_skip_subcategory(sub):
                    meta["subcategories_skipped"] += 1
                continue
            child_path = f"{path} > {category_display(sub)}"
            if is_biographical_category_path(child_path):
                meta["subcategories_skipped"] += 1
                continue
            queue.append((sub, child_path))

    for org in organizations.values():
        paths = sorted(
            p for p in org.pop("_paths", {org["category_path"]})
            if not is_biographical_category_path(p)
        )
        if not paths:
            continue
        org["category_path"] = paths[0]
        org["category_paths"] = " | ".join(paths)

    filtered = [o for o in organizations.values() if o.get("category_path")]
    return [], filtered, meta


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Crawling Wikipedia categories (institutions only, cached)...", flush=True)
    _, organizations, meta = crawl(ROOT_CATEGORY)

    organizations.sort(key=lambda r: (r["category_path"], r["name"].lower()))

    fields = [
        "id",
        "name",
        "entry_type",
        "letter_group",
        "org_kind",
        "wikipedia_url",
        "category_path",
        "category_paths",
        "found_in_category_url",
        "source",
        "source_url",
    ]

    rows = organizations
    out_path = OUT_DIR / "azerbaijan-state-organizations.csv"
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for i, row in enumerate(rows, 1):
            if not row.get("category_paths"):
                row["category_paths"] = row.get("category_path", "")
            writer.writerow({"id": f"gov-{i:04d}", **row})

    depths = [r["category_path"].count(" > ") for r in organizations]
    stats = {
        "organizations": len(organizations),
        "total_rows": len(rows),
        "categories_visited": meta["categories_visited"],
        "subcategories_skipped_bio": meta["subcategories_skipped"],
        "articles_skipped_bio": meta["articles_skipped"],
        "api_calls": meta["api_calls"],
        "max_category_depth": max(depths) if depths else 0,
        "source": ROOT_CATEGORY_URL,
        "note": "Institutions only — biographical subcategories and person articles excluded.",
    }
    (OUT_DIR / ".scrape-stats.json").write_text(
        json.dumps(stats, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
