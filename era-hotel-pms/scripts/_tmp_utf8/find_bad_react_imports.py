from pathlib import Path
import re

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms/app")
bad = []
for p in ROOT.rglob("page.tsx"):
    t = p.read_text(encoding="utf-8")
    # UI symbols imported from react
    m = re.search(r"import\s*\{([^}]+)\}\s*from\s*'react';", t)
    if not m:
        continue
    names = m.group(1)
    uiish = [x.strip() for x in names.split(",") if x.strip() and not x.strip().startswith("use") and x.strip() not in {"Fragment", "Suspense", "type", "ReactNode", "ReactElement", "ComponentProps", "CSSProperties", "FormEvent", "ChangeEvent", "MouseEvent", "KeyboardEvent", "ReactNode as RN"}]
    # filter type imports like `type X`
    uiish = [x for x in uiish if not x.startswith("type ") and x[0].isupper() or x in {"showApiError","showSuccess"}]
    # uppercase component-like from react is suspicious
    suspicious = []
    for part in names.split(","):
        part = part.strip()
        if not part or part.startswith("type ") or part.startswith("use"):
            continue
        base = part.split(" as ")[0].strip()
        if base in {"Fragment", "Suspense", "StrictMode", "Component", "PureComponent", "Children", "cloneElement", "createElement", "createContext", "lazy", "memo", "forwardRef", "startTransition"}:
            continue
        if base[0].isupper() or base.startswith("show") or base.startswith("MODAL") or base.startswith("PRIMARY") or base.startswith("DATA_") or base.startswith("FORM_") or base.startswith("CARD_") or base.startswith("GHOST_") or base.startswith("SECONDARY_"):
            suspicious.append(base)
    if suspicious:
        bad.append((p.as_posix(), suspicious[:12]))

for f, s in bad:
    print(f)
    print(" ", s)
print("COUNT", len(bad))
