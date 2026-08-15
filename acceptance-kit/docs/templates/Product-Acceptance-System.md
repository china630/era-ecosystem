# <Product> — Acceptance System

**Canon:** [`Product-Acceptance-Standard.md`](../products/Product-Acceptance-Standard.md)  
**Readiness SSOT:** [`<Product>-Product-Readiness-Matrix.md`](../<Product>-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`<Product>-Implementation-Matrix.md`](../<Product>-Implementation-Matrix.md)  
**Evidence:** [`<Product>-Evidence-Rules.md`](../<Product>-Evidence-Rules.md)  
**Index:** [`<Product>-Sprint-Index.md`](../<Product>-Sprint-Index.md)

---

## Scope

- In scope: …
- Out of scope: …

## Definition of Done (soft / scaffold)

- [ ] Unit / golden tests for changed surface
- [ ] Stage-gate log under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [ ] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] `check-acceptance-consistency.ps1` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after Pilot-ready

## Gate script

```powershell
pwsh -File scripts/run-<product>-stage-gate.ps1 -Stage <wave>
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌
