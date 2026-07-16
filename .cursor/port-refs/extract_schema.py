import subprocess
from pathlib import Path

root = Path(r"d:\My Projects\era-ecosystem")
branch = "integration/finance-waves-holdings-datahub"
schema = subprocess.check_output(
    [
        "git",
        "-C",
        str(root),
        "show",
        f"{branch}:era-finance-core/packages/database/prisma/schema.prisma",
    ],
    text=True,
    encoding="utf-8",
)
targets = [
    "model IntangibleAsset",
    "model IntangibleAssetAmortizationMonth",
    "model SubcontoType",
    "model AccountSubcontoConfig",
    "model JournalEntryDimension",
    "model StatReportDefinition",
    "model StatReportRun",
    "model ProfitTaxAdjustment",
    "enum EqaimeStatus",
    "enum SubcontoKind",
    "enum TaxDeclarationType",
    "enum StatReportPeriodicity",
]
lines = schema.splitlines()
out: list[str] = []
for t in targets:
    for i, l in enumerate(lines):
        if l == t or l.startswith(t + " ") or l.startswith(t + "{"):
            brace = 0
            started = False
            block: list[str] = []
            for j in range(i, min(i + 200, len(lines))):
                block.append(lines[j])
                brace += lines[j].count("{") - lines[j].count("}")
                if "{" in lines[j]:
                    started = True
                if started and brace <= 0:
                    break
            out.append("\n".join(block))
            out.append("")
            break

path = root / ".cursor" / "port-refs" / "schema-excerpts.prisma"
path.write_text("\n".join(out), encoding="utf-8")
print("wrote", path, "blocks", sum(1 for x in out if x.startswith("model") or x.startswith("enum")))
