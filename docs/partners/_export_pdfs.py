from pathlib import Path
import subprocess
import time

chrome = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
dirp = Path(r"D:\My Projects\era-ecosystem\docs\partners")

jobs = [
    ("era365-pasha-executive-deck.html", "ERA365-Pasha-Partnership-Executive-EN.pdf", "en"),
    ("era365-pasha-executive-deck.html", "ERA365-Pasha-Partnership-Executive-AZ.pdf", "az"),
    ("era365-pasha-product-catalog-deck.html", "ERA365-Pasha-Product-Catalog-EN.pdf", "en"),
    ("era365-pasha-product-catalog-deck.html", "ERA365-Pasha-Product-Catalog-AZ.pdf", "az"),
]

force_en = """
<style id="force-lang">
html { --x:1; }
.lang-az { display: none !important; }
.lang-en { display: block !important; }
span.lang-en, a.lang-en, strong.lang-en { display: inline !important; }
table.lang-en { display: table !important; }
ul.lang-en, ol.lang-en { display: grid !important; }
li.lang-en { display: list-item !important; }
</style>
"""
force_az = """
<style id="force-lang">
.lang-en { display: none !important; }
.lang-az { display: block !important; }
span.lang-az, a.lang-az, strong.lang-az { display: inline !important; }
table.lang-az { display: table !important; }
ul.lang-az, ol.lang-az { display: grid !important; }
li.lang-az { display: list-item !important; }
</style>
"""

tmp_dir = dirp / "_pdf_tmp"
tmp_dir.mkdir(exist_ok=True)

for src_name, pdf_name, lang in jobs:
    src = dirp / src_name
    html = src.read_text(encoding="utf-8")
    # lock language attribute for CSS selectors too
    html = html.replace('<html lang="en" data-lang="en">', f'<html lang="{lang}" data-lang="{lang}">', 1)
    inject = force_az if lang == "az" else force_en
    html = html.replace("</head>", inject + "\n</head>", 1)
    tmp = tmp_dir / f"{pdf_name}.html"
    tmp.write_text(html, encoding="utf-8")
    pdf = dirp / pdf_name
    out = dirp / pdf_name.replace(".pdf", "-v2.pdf")
    if out.exists():
        try:
            out.unlink()
        except PermissionError:
            out = dirp / pdf_name.replace(".pdf", f"-{lang}-new.pdf")
    url = tmp.resolve().as_uri()
    subprocess.run(
        [chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out}", url],
        check=False,
    )
    for _ in range(40):
        if out.exists() and out.stat().st_size > 50_000:
            break
        time.sleep(0.25)
    if not out.exists():
        raise SystemExit(f"PDF missing: {out.name}")
    # try replace original
    try:
        if pdf.exists():
            pdf.unlink()
        out.rename(pdf)
        print(f"OK {pdf.name} {pdf.stat().st_size // 1024}KB")
    except PermissionError:
        print(f"LOCKED original; left as {out.name} ({out.stat().st_size // 1024}KB)")

print("done")
