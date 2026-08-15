from pathlib import Path
import re

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms/app")

STATUS_INLINE = (
    '{msg ? (\n'
    '        <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">\n'
    '          {msg}\n'
    '        </p>\n'
    '      ) : null}'
)

def ensure_card_import(text: str) -> str:
    if "CARD_CONTAINER_CLASS" in text:
        # already referenced — make sure imported
        if re.search(r"CARD_CONTAINER_CLASS", text.split("from '@era/satellite-kit/ui'")[0] if "from '@era/satellite-kit/ui'" in text else ""):
            return text
    # Find satellite-kit import block(s)
    def add_to_import(m):
        block = m.group(0)
        if "CARD_CONTAINER_CLASS" in block:
            return block
        # insert after opening brace
        return re.sub(r"\{\s*", "{\n  CARD_CONTAINER_CLASS,\n  ", block, count=1)

    new, n = re.subn(
        r"import\s*\{[^}]+\}\s*from\s*'@era/satellite-kit/ui';",
        add_to_import,
        text,
        count=1,
        flags=re.S,
    )
    if n:
        return new
    # no kit import — add one
    m = re.search(r"('use client';\s*)", text)
    if m:
        insert = m.end()
        return text[:insert] + "\n\nimport {\n  CARD_CONTAINER_CLASS,\n} from '@era/satellite-kit/ui';\n" + text[insert:]
    return text

def replace_page_sections(text: str) -> str:
    # title + className (simple quoted className)
    def repl_title_class(m):
        title_expr = m.group(1)
        cls = m.group(2)
        return (
            f'<section className={{`${{CARD_CONTAINER_CLASS}} p-4 {cls}`}}>\n'
            f'          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{title_expr}</h2>'
        )

    text = re.sub(
        r'<PageSection\s+title=\{([^}]+)\}\s+className="([^"]*)"\s*>',
        repl_title_class,
        text,
    )
    text = re.sub(
        r'<PageSection\s+title=\{([^}]+)\}\s*>',
        lambda m: (
            f'<section className={{`${{CARD_CONTAINER_CLASS}} p-4`}}>\n'
            f'          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{m.group(1)}</h2>'
        ),
        text,
    )

    # className="..."
    text = re.sub(
        r'<PageSection\s+className="([^"]*)"\s*>',
        lambda m: f'<section className={{`${{CARD_CONTAINER_CLASS}} p-4 {m.group(1)}`}}>',
        text,
    )

    # multiline template className: <PageSection\n className={`...`}>\n
    def repl_tmpl(m):
        inner = m.group(1)
        return f'<section\n          className={{`${{CARD_CONTAINER_CLASS}} p-4 {inner}`}}>\n'

    text = re.sub(
        r'<PageSection\s+className=\{`([\s\S]*?)`\}\s*>',
        repl_tmpl,
        text,
    )

    text = text.replace("<PageSection>", '<section className={`${CARD_CONTAINER_CLASS} p-4`}>')
    text = text.replace("</PageSection>", "</section>")
    return text

def strip_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "layout/AppShell" not in text:
        return False
    original = text

    text = re.sub(r"<AppShell[^>]*>\s*", "", text)
    text = re.sub(r"\s*</AppShell>", "", text)

    text = text.replace("<StatusMessage>{msg}</StatusMessage>", STATUS_INLINE)

    used_section = "PageSection" in text
    text = replace_page_sections(text)

    # drop AppShell imports
    text = re.sub(
        r"import\s+AppShell(?:,\s*\{[^}]*\})?\s+from\s+'@/components/layout/AppShell';\n?",
        "",
        text,
    )
    text = re.sub(
        r"import\s+\{[^}]*\}\s+from\s+'@/components/layout/AppShell';\n?",
        "",
        text,
    )

    if used_section or "CARD_CONTAINER_CLASS" in text:
        text = ensure_card_import(text)

    # cleanup double blank lines at import area
    text = re.sub(r"\n{3,}", "\n\n", text)

    if "PageSection" in text or "AppShell" in text or "StatusMessage" in text or "layout/AppShell" in text:
        print("WARN leftover", path.relative_to(ROOT), 
              "PageSection" if "PageSection" in text else "",
              "AppShell" if "AppShell" in text else "",
              "StatusMessage" if "StatusMessage" in text else "")

    path.write_text(text, encoding="utf-8", newline="\n")
    b = path.read_bytes()
    assert b[1] != 0
    print("stripped", path.relative_to(ROOT).as_posix())
    return True

count = 0
for p in ROOT.rglob("page.tsx"):
    if strip_file(p):
        count += 1
print("TOTAL stripped", count)
