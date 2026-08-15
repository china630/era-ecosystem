from pathlib import Path
d = Path("era-clinic/doc/DELIVERY-CLINIC.md")
lines = d.read_text(encoding="utf-8").splitlines(True)
out = []
done = False
extra1 = "- [x] Diagnostic catalog **DB source of truth** (CLI-32) - Modality/DiagnosticService/DiagnosticAnalyte; seed from JSON; SatAdmin `/admin/diagnostic-catalog` CRUD - ADR [clinic-diagnostic-catalog-db.md](../../docs/adr/clinic-diagnostic-catalog-db.md)\n"
extra2 = "- [x] Lab order normalization (CLI-32) - `LabOrderItem` + `LabResult`; dual-write legacy `testCode`/`resultJson`; backfill; results read-only after PUBLISHED; `/lab-orders` DATA_TABLE + filters/pagination\n"
for line in lines:
    out.append(line)
    if (not done) and "Diagnostic catalog UI" in line and "catalog-favorites" in line:
        if "LabOrderItem" not in "".join(lines):
            out.append(extra1)
            out.append(extra2)
        done = True
d.write_text("".join(out), encoding="utf-8")
print("done", done)
