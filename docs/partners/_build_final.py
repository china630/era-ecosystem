"""
Build FINAL monolingual PDFs for ERA 365 × Pasha decks.
Opposite-language nodes are physically removed (no CSS hide).
"""
from __future__ import annotations

import re
import subprocess
import time
from html.parser import HTMLParser
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    subprocess.check_call(["python", "-m", "pip", "install", "beautifulsoup4", "-q"])
    from bs4 import BeautifulSoup

DIR = Path(r"D:\My Projects\era-ecosystem\docs\partners")
CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
OUT_DIR = DIR / "FINAL"
TMP = DIR / "_pdf_tmp"
OUT_DIR.mkdir(exist_ok=True)
TMP.mkdir(exist_ok=True)

# Shared CSS patches applied to both source decks before split
SHARED_CSS_APPEND = """
    /* Final readability (monolingual — keep blocks roomy) */
    .panel {
      padding: 16px 16px 14px !important;
      min-height: 118px;
    }
    .panel.slate {
      background: linear-gradient(160deg, #243442 0%, #34495E 55%, #2A4054 100%) !important;
      color: #F2F6FA !important;
      border: 0 !important;
    }
    .panel.slate .mini { color: #9EB6C8 !important; }
    .panel.slate h3 { color: #FFFFFF !important; }
    .panel.slate p,
    .panel.slate li,
    .panel.slate ul.mods li { color: #E4EEF6 !important; }
    .panel.slate ul.mods li::before { background: #5DB0E0 !important; }
    .panel.hero ul.mods li { color: rgba(255,255,255,.95) !important; }
    .why, .az-flag {
      margin-top: 12px !important;
      padding: 14px 16px !important;
      min-height: 64px;
      font-size: 13px !important;
      line-height: 1.45 !important;
      border-width: 1px !important;
      border-left-width: 5px !important;
      display: block !important;
    }
    .az-flag {
      border-left: 5px solid #1F8A70 !important;
    }
    .why {
      border-left: 5px solid #1F8A70 !important;
    }
    .why-label, .az-flag .why-label {
      white-space: nowrap !important;
      display: inline !important;
    }
    ul.clean li, ul.mods li { font-size: 13px !important; line-height: 1.4 !important; }
    .arch-box { padding: 14px 15px !important; min-height: 72px; }
    .arch-box .d { font-size: 13px !important; line-height: 1.4 !important; }
    .sat { min-height: 102px; padding: 13px !important; }
    .note { padding: 12px 14px !important; font-size: 13px !important; }
"""


def patch_source(html: str) -> str:
    # Ensure slate list colors aren't overridden by global ul.mods li
    if "/* Final readability" not in html:
        html = html.replace("</style>", SHARED_CSS_APPEND + "\n  </style>", 1)

    # Names: language-specific only (no mixed scripts)
    html = re.sub(
        r'<div class="name">Chingiz Shirinov</div>\s*'
        r'<div class="role lang-en">Founder / CEO · ERA 365<br />Çingiz Şirinov · Чингиз Ширинов</div>\s*'
        r'<div class="role lang-az">Təsisçi / CEO · ERA 365<br />Chingiz Shirinov · Чингиз Ширинов</div>',
        '<div class="name lang-en">Chingiz Shirinov</div>\n'
        '            <div class="name lang-az">Çingiz Şirinov</div>\n'
        '            <div class="role lang-en">Founder / CEO · ERA 365</div>\n'
        '            <div class="role lang-az">Təsisçi / CEO · ERA 365</div>',
        html,
    )
    html = re.sub(
        r'<div class="name">Oksana Stepenko</div>\s*'
        r'<div class="role lang-en">Director · Axoft Azerbaijan \(distributor\)<br />Оксана Степенко · директор компании-дистрибьютора Axoft Azerbaijan</div>\s*'
        r'<div class="role lang-az">Direktor · Axoft Azerbaijan \(distributor\)<br />Оксана Степенко · Axoft Azerbaijan distributor şirkətinin direktoru</div>',
        '<div class="name lang-en">Oksana Stepenko</div>\n'
        '            <div class="name lang-az">Oksana Stepenko</div>\n'
        '            <div class="role lang-en">Director · Axoft Azerbaijan (distributor)</div>\n'
        '            <div class="role lang-az">Direktor · Axoft Azerbaijan (distributor)</div>',
        html,
    )
    return html


def strip_language(html: str, keep: str) -> str:
    """Physically remove nodes tagged with the opposite language class."""
    drop = "lang-az" if keep == "en" else "lang-en"
    soup = BeautifulSoup(html, "html.parser")
    # lock html attrs
    if soup.html:
        soup.html["lang"] = keep
        soup.html["data-lang"] = keep
    # remove toolbar (PDF only)
    for tb in soup.select(".toolbar"):
        tb.decompose()
    # remove scripts (avoid lang toggle)
    for sc in soup.find_all("script"):
        sc.decompose()
    # remove opposite language nodes (collect first — do not mutate while walking)
    to_drop = []
    for el in soup.find_all(True):
        classes = el.get("class") or []
        if drop in classes:
            to_drop.append(el)
    for el in to_drop:
        el.decompose()
    # unwrap remaining lang-XX classes (optional cleanup)
    for el in list(soup.find_all(True)):
        if el is None or not getattr(el, "attrs", None):
            continue
        classes = el.get("class") or []
        if keep == "en" and "lang-en" in classes:
            classes = [c for c in classes if c != "lang-en"]
            if classes:
                el["class"] = classes
            elif "class" in el.attrs:
                del el["class"]
        if keep == "az" and "lang-az" in classes:
            classes = [c for c in classes if c != "lang-az"]
            if classes:
                el["class"] = classes
            elif "class" in el.attrs:
                del el["class"]
    # inject print-safe base
    if soup.head:
        style = soup.new_tag("style")
        style.string = """
          .toolbar,script{display:none!important}
          .panel.slate,.panel.slate *{color:inherit}
          .panel.slate{color:#F2F6FA!important}
          .panel.slate .mini{color:#9EB6C8!important}
          .panel.slate h3{color:#fff!important}
          .panel.slate li{color:#E4EEF6!important}
        """
        soup.head.append(style)
    return str(soup)


def chrome_pdf(html_path: Path, pdf_path: Path) -> None:
    if pdf_path.exists():
        try:
            pdf_path.unlink()
        except PermissionError:
            pdf_path = pdf_path.with_name(pdf_path.stem + "-NEW.pdf")
    url = html_path.resolve().as_uri()
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--virtual-time-budget=10000",
            f"--print-to-pdf={pdf_path}",
            url,
        ],
        check=False,
    )
    for _ in range(50):
        if pdf_path.exists() and pdf_path.stat().st_size > 40_000:
            break
        time.sleep(0.2)
    if not pdf_path.exists():
        raise SystemExit(f"Failed: {pdf_path.name}")
    print(f"OK {pdf_path.name} ({pdf_path.stat().st_size // 1024} KB)")


def build():
    jobs = [
        ("era365-pasha-executive-deck.html", "ERA365-Pasha-Part1-Executive"),
        ("era365-pasha-product-catalog-deck.html", "ERA365-Pasha-Part2-Product-Catalog"),
    ]
    # Persist patched sources
    for src_name, _ in jobs:
        src = DIR / src_name
        patched = patch_source(src.read_text(encoding="utf-8"))
        src.write_text(patched, encoding="utf-8")

    for src_name, stem in jobs:
        src_html = (DIR / src_name).read_text(encoding="utf-8")
        for lang in ("en", "az"):
            mono = strip_language(src_html, lang)
            tmp_html = TMP / f"{stem}-{lang}.html"
            tmp_html.write_text(mono, encoding="utf-8")
            # Also save clean source copies for transparency
            clean = OUT_DIR / f"{stem}-{lang.upper()}.html"
            clean.write_text(mono, encoding="utf-8")
            pdf = OUT_DIR / f"{stem}-{lang.upper()}.pdf"
            chrome_pdf(tmp_html, pdf)

    # Verify monolingual
    try:
        from pypdf import PdfReader
    except ImportError:
        subprocess.check_call(["python", "-m", "pip", "install", "pypdf", "-q"])
        from pypdf import PdfReader

    report = []
    az_markers = ["tərəfdaşlıq", "Niyə", "Konfidensial", "hissə", "satelliti", "üçün"]
    en_markers = ["Why this conversation", "Partnership proposal", "Founder / CEO", "Why ERA 365"]
    for pdf in sorted(OUT_DIR.glob("*.pdf")):
        text = "\n".join((p.extract_text() or "") for p in PdfReader(str(pdf)).pages)
        az = [m for m in az_markers if m in text]
        en = [m for m in en_markers if m in text]
        is_en = "-EN.pdf" in pdf.name
        leak = az if is_en else [m for m in en_markers if m in text and m not in ("Why ERA 365",)]
        # For AZ, EN product names like Finance Core / Orchestrator are OK; flag prose leaks
        prose_en = [m for m in ["Why this conversation", "Partnership proposal", "Founder / CEO", "Pain"] if m in text]
        bad = az if is_en else prose_en
        report.append(f"{pdf.name}|pages={len(PdfReader(str(pdf)).pages)}|leak={bad}|oksana={'Oksana Stepenko' in text}")
    (OUT_DIR / "_verify.txt").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report))
    print(f"\nFINAL PDFs in: {OUT_DIR}")


if __name__ == "__main__":
    build()
