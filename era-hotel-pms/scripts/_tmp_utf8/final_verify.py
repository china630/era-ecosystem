from pathlib import Path
import re

root = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms/app")
date = dt = prompt = appshell = 0
for p in root.rglob("page.tsx"):
    t = p.read_text(encoding="utf-8")
    date += len(re.findall(r'type=["\']date["\']', t))
    dt += t.count("datetime-local")
    prompt += t.count("window.prompt")
    appshell += len(re.findall(r"from ['\"]@/components/layout/AppShell['\"]", t))

print(f"type=date count in app/**/page.tsx = {date}")
print(f"datetime-local count = {dt}")
print(f"window.prompt count = {prompt}")
print(f"AppShell import count = {appshell}")

# sanity: fragment close style + CARD import where section uses it
missing_card = []
for p in root.rglob("page.tsx"):
    t = p.read_text(encoding="utf-8")
    if "CARD_CONTAINER_CLASS" in t and "CARD_CONTAINER_CLASS," not in t.split("from '@era/satellite-kit/ui'")[0] and "CARD_CONTAINER_CLASS }" not in t.split("from '@era/satellite-kit/ui'")[0]:
        # check import properly
        if not re.search(r"CARD_CONTAINER_CLASS", t[: t.find("from '@era/satellite-kit/ui'") if "from '@era/satellite-kit/ui'" in t else 0]):
            missing_card.append(p.as_posix())
print("missing card import suspects", len(missing_card))
for x in missing_card[:10]:
    print(x)
