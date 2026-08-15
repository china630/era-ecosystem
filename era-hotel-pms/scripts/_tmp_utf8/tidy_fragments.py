from pathlib import Path
root = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms/app")
n = 0
for p in root.rglob("page.tsx"):
    t = p.read_text(encoding="utf-8")
    if "</>);" in t:
        t2 = t.replace("</>);", "</>\n  );")
        p.write_text(t2, encoding="utf-8", newline="\n")
        n += 1
        print("tidied", p.relative_to(root).as_posix())
print("tidied count", n)
