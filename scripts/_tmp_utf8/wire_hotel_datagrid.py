
from pathlib import Path
import re

root = Path("era-hotel-pms")
changed = []
for f in root.rglob("*.tsx"):
    if f.name == "HotelDataGrid.tsx":
        continue
    t = f.read_text(encoding="utf-8")
    if "EraDataGrid" not in t or "@era/satellite-kit/ui" not in t:
        continue
    orig = t
    t2 = t.replace("EraDataGrid", "HotelDataGrid")
    t2 = t2.replace("HotelDataGridProps", "EraDataGridProps")
    t2 = t2.replace("HotelDataGridColumn", "EraDataGridColumn")
    # strip HotelDataGrid from kit import lists
    t2 = re.sub(r"HotelDataGrid\s*,\s*", "", t2)
    t2 = re.sub(r",\s*HotelDataGrid\b", "", t2)
    if "@/components/HotelDataGrid" not in t2:
        m = re.search(r"from [\"\x27]@era/satellite-kit/ui[\"\x27];\n", t2)
        insert = "import { HotelDataGrid } from \"@/components/HotelDataGrid\";\n"
        if m:
            t2 = t2[: m.end()] + insert + t2[m.end() :]
        else:
            t2 = insert + t2
    if t2 != orig:
        f.write_text(t2, encoding="utf-8", newline="\n")
        changed.append(str(f))
print("changed", len(changed))
for c in changed:
    print(c)
