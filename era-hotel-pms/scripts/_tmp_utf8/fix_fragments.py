from pathlib import Path
import re

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms")

# Fix analytics titles
p = ROOT / "app/reports/analytics/page.tsx"
text = p.read_text(encoding="utf-8")
text = text.replace(
    '">{t(\'bookingSourcesTitle\')}</h2>'.replace("\\'", "'") if False else '">t(\'bookingSourcesTitle\')</h2>',
    '">{t(\'bookingSourcesTitle\')}</h2>',
)
# simpler direct replacements
text = text.replace(
    """<h2 className="mb-3 text-sm font-semibold text-[#34495E]">t('bookingSourcesTitle')</h2>""",
    """<h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('bookingSourcesTitle')}</h2>""",
)
text = text.replace(
    """<h2 className="mb-3 text-sm font-semibold text-[#34495E]">t('cancellationsTitle')</h2>""",
    """<h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('cancellationsTitle')}</h2>""",
)
text = text.replace(
    """<h2 className="mb-3 text-sm font-semibold text-[#34495E]">t('demographicsTitle')</h2>""",
    """<h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('demographicsTitle')}</h2>""",
)
p.write_text(text, encoding="utf-8", newline="\n")
print("analytics titles fixed")

# Wrap multi-root returns that lost AppShell
FILES = [
    "app/operations/page.tsx",
    "app/reservations/[id]/page.tsx",
    "app/housekeeping/page.tsx",
    "app/medical/page.tsx",
    "app/concierge/page.tsx",
    "app/dispatch/page.tsx",
    "app/reports/guest-dedup/page.tsx",
]

def needs_fragment(src: str) -> bool:
    # Heuristic: return ( followed by JSX that has sibling at top after PageHeader without <>
    return False

def wrap_main_return(path: Path):
    text = path.read_text(encoding="utf-8")
    # Find `return (` that previously had AppShell — look for PageHeader then sibling without fragment
    # Fix known broken patterns: return (\n    <PageHeader ... />\n      <Something
    # Wrap entire return body in <> </>

    # Pattern for reservation page specifically
    if path.name == "page.tsx" and "ReservationCardEditor" in text and "<>" not in text[text.find("return ("):text.find("ReservationCardEditor")+80]:
        old = """  return (
    <PageHeader
        title={tb('reservationCardTitle')}
        actions={
          <Link href="/" className="text-[13px] text-[#2980B9] hover:underline">
            {t('backToRack')}
          </Link>
        }
      />
      <ReservationCardEditor
        layout="page"
        open
        reservationId={id}
        onClose={() => router.push('/')}
      />
  );"""
        new = """  return (
    <>
      <PageHeader
        title={tb('reservationCardTitle')}
        actions={
          <Link href="/" className="text-[13px] text-[#2980B9] hover:underline">
            {t('backToRack')}
          </Link>
        }
      />
      <ReservationCardEditor
        layout="page"
        open
        reservationId={id}
        onClose={() => router.push('/')}
      />
    </>
  );"""
        if old in text:
            text = text.replace(old, new)
            path.write_text(text, encoding="utf-8", newline="\n")
            print("fragment", path)
            return

    # Generic: if file has `return (\n    <PageHeader` and next non-ws after PageHeader self-close is another tag at indent, wrap
    # Find last major return ( with PageHeader
    idx = text.rfind("return (\n    <PageHeader")
    if idx < 0:
        idx = text.rfind("return (\n      <PageHeader")
    if idx < 0:
        print("skip no pattern", path)
        return
    # find matching closing of return — naive: last `\n  );` or `\n    );` before end of function
    # Insert <> after return (
    open_paren = text.find("(", idx)
    # skip whitespace
    i = open_paren + 1
    while i < len(text) and text[i] in " \t\r\n":
        i += 1
    if text.startswith("<>", i):
        print("already fragment", path)
        return
    # find the closing `);` of this return — from end of function: search for `\n  );\n}` near end
    # Better: find matching paren depth from open_paren
    depth = 0
    j = open_paren
    while j < len(text):
        c = text[j]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                break
        j += 1
    # body is text[i:j]
    body = text[i:j]
    # only wrap if multiple top-level JSX-ish nodes: count of lines starting with < at indent 4-6 after first
    # Always wrap if body has PageHeader and another component/section
    if "<PageHeader" in body and ("<section" in body or "<EraModal" in body or "<ReservationCardEditor" in body or "{msg" in body or "{summary" in body or "{status" in body or "<ul" in body):
        new_body = "<>\n      " + body.strip() + "\n    </>"
        text = text[:i] + new_body + text[j:]
        path.write_text(text, encoding="utf-8", newline="\n")
        print("wrapped", path.relative_to(ROOT).as_posix())
    else:
        print("no wrap needed?", path.relative_to(ROOT).as_posix())

for rel in FILES:
    wrap_main_return(ROOT / rel)
