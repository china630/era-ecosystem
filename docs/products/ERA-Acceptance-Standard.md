# ERA Product Acceptance Standard (canon)

**Version:** 1.0 (ERA Ecosystem)  
**Status:** Active  
**Portable upstream:** [`acceptance-kit/`](../../acceptance-kit/)  
**Consistency check:** `npm run check:acceptance` (`scripts/check-acceptance-consistency.mjs`)  
**Agent rule:** [`.cursor/rules/task-acceptance.mdc`](../../.cursor/rules/task-acceptance.mdc)

---

## 1. Why

At any time the team and product owner must see for **each** product line:

1. **What was promised** (PRD / TZ / AC groups)
2. **What was built** (code + test)
3. **Which stage** (wave / edition)
4. **How well it matches expectations** — only with proof

No “green in our heads”. Rule: **no log / CI artifact / UAT-SMOKE UI path → no gate/`[x]` / no SHIPPED claim without evidence**.

**Invariants:**

1. scaffold-gate ≠ pilot / field sign-off  
2. stage `gate[x]` ≠ AC Scaffold ✅  
3. **AC Scaffold Matrix ≠ Product Readiness** (UI / demo / field)  
4. headers / PRD / MODULES_CATALOG **DONE** must not paint sell/show green over Readiness 🟡/❌  

### Relationship to existing ERA docs

| Document | Role |
|----------|------|
| [`docs/COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md) | Capability × Doc/API/UI × actors (SHIPPED/API/STUB) — **fact source** |
| [`docs/READINESS_MATRIX.md`](../READINESS_MATRIX.md) | Engineering API levels + DELIVERY % — **not** sell/show |
| `era-*/doc/DELIVERY*.md` | Engineering checklists |
| `era-*/doc/UAT-SMOKE.md` | Lab / UI smoke paths |
| `docs/acceptance/*-Implementation-Matrix.md` | SSOT **AC / Scaffold BE** |
| `docs/acceptance/*-Product-Readiness-Matrix.md` | SSOT **can we show / pilot / sell?** |
| `docs/editions/*.yaml` | SSOT edition `roadmap`/`scaffold`/`mvp`/`ga` (not DB `pricing_modules`) |

---

## 2. Required stack (per product)

```
PRD / TZ (+ AC groups linked to COVERAGE IDs)
        ↓
Sprint-Index (Gate | AC rollup | Pilot-ready)
        ↓
Implementation-Matrix                 ← SSOT AC / Scaffold BE
        ↓
Product-Readiness-Matrix              ← SSOT product readiness (one screen)
        ↓
Evidence-Rules + reports/*-signoff.md
        ↓
scripts/run-<product>-stage-gate.mjs  (+ check-acceptance-consistency)
        ↓
Pilot lab / field checklists
```

| Layer | Question |
|-------|----------|
| PRD / TZ | *What do we sell?* |
| **Capability Inventory** (when present) | *What is IN / PARTIAL / DECLARED / OUT vs a full product category?* |
| COVERAGE_MATRIX | *Doc/API/UI for which actors?* |
| Sprint-Index | *Gate / AC / Pilot?* |
| **Implementation-Matrix** | *Is the PRD AC closed on API/engine?* |
| **Product-Readiness-Matrix** | *Can we show / pilot / sell?* |
| Evidence-Rules | *May we ✅ / `ga`?* |
| READINESS_MATRIX | *Engineering API/consumer hooks?* (separate track) |

**Bank:** [`Bank-Capability-Inventory.md`](../acceptance/Bank-Capability-Inventory.md) is mandatory for sell/show honesty. In-scope AC all ✅ must **not** be narrated as «полная коммерческая АБС» while CAP-* OUT rows exist.

---

## 3. Status legend

### 3.1. Three levels (do not mix)

| Level | Where | Marker | Meaning |
|-------|-------|--------|---------|
| **Gate** | Sprint-Index / stage-spec | `gate[x]` / `[~]` / `[ ]` | stage-gate log or signoff PASS |
| **AC Scaffold** | Implementation-Matrix | ✅ / 🟡 / `[ ]` | PRD intent + negative path |
| **Product ready** | Readiness Pilot + editions | `[x]` / `[ ]` / ⏸ · `mvp`/`ga` | staging/field / edition |

Backlog: `[ ]` · `[~]` · `[x]` (done with proof) · `[blocked]`.

COVERAGE **SHIPPED** maps to UI/API facts; it does **not** auto-set Scaffold ✅ (needs negative path) or edition `ga`.

### 3.2. Implementation-Matrix

**Scaffold ✅ only if all of:**

1. Proof covers **PRD AC wording** (including negative path: spoof → 401/403, deny → stated effect, stub → explicit `mode=stub`).  
2. **Worst-component:** no sub-component of the same AC is 🟡 / `[ ]`.  
3. No open **Critical residual** in the same AC contour.  
4. AC is **not** field-intent.

Otherwise → **🟡**, even with COVERAGE SHIPPED or green stage-gate.

**No soft-green on field AC:** customer/prod/field wording → Scaffold max **🟡**.

AC rows are **groups** of COVERAGE IDs (do not duplicate every CLI-01 row).

### 3.3. Edition honesty (`docs/editions/*.yaml` only)

| status | When |
|--------|------|
| `roadmap` | No product-ready proof |
| `scaffold` | Skeleton without full gate |
| `mvp` | Unit/gate PASS; **not** field |
| `ga` | `pilot_ready: true` + field / partner sign-off |

False `ga` without Pilot-ready is **forbidden**.  
Banned prose: `ga (partner)`, `ga (greenfield)` while yaml = `mvp`.

### 3.4. Two SSOTs (do not mix)

| SSOT | File | Question |
|------|------|----------|
| **AC / Scaffold** | `docs/acceptance/*-Implementation-Matrix.md` | Is the PRD AC closed (BE/API/engine)? |
| **Product Readiness** | `docs/acceptance/*-Product-Readiness-Matrix.md` | Is the **product** ready (UI, demo, pilot, sell)? |

```
Ask «можно показывать / пилот / продавать / Product Readiness»
  → Product-Readiness-Matrix only.

Ask «Scaffold / AC / backend matrix»
  → Implementation-Matrix.

Ask «матрица готовности API / §4 / consumer / обнови READINESS»
  → docs/READINESS_MATRIX.md + skill era-readiness-matrix
  (engineering — NOT sell/show)
```

**Product Readiness — required columns:**

| Edition | Gate | Scaffold BE | UI* | Demo / TE* | Pilot lab | Pilot field | Edition | Sell / show |

```
Product_edition = worst(Gate, BE, UI*, Demo*, Pilot lab, Pilot field)
  order: [ ] / ❌ < 🟡 < ✅
```

### 3.5. Consistency (one PR)

When AC Scaffold **or** UI/TE/Pilot status changes — same PR:

1. Implementation-Matrix (if AC)  
2. Product-Readiness-Matrix summary  
3. Sprint-Index header  
4. COVERAGE_MATRIX row(s) if capability status changed  
5. editions yaml if edition/sell claim changed  

Check: `npm run check:acceptance` (strict: `npm run check:acceptance:strict`).

---

## 4. Stage Gate (G1…G6)

| # | Check | Proof |
|---|-------|-------|
| G1 | Stage auto-tests / audit | `run-<product>-stage-gate.mjs` PASS |
| G2 | E2E (if any) | `reports/<product>-stage-<wave>-e2e.log` |
| G3 | Matrix updated; no false all-✅ | PR diff |
| G4 | Index: **gate[x]** + AC rollup | PR diff Index |
| G5 | editions (if sell claim) | yaml + consistency |
| G6 | Signoff | `reports/<product>-stage-<wave>-signoff.md` = `scaffold-gate-pass` |

---

## 5. Task workflow

### Finished

1. Tests / UAT-SMOKE UI path  
2. Stage-gate → `gate[x]` + signoff  
3. Implementation-Matrix: ✅ only per §3.2; else 🟡  
4. Product-Readiness + COVERAGE sync  
5. `npm run check:acceptance` PASS  

### Before GA

Pilot checklist signed; edition `ga` only with `pilot_ready: true` + Pilot field evidence.

---

## 6. Product map

| Product | Acceptance-System | Product Readiness | AC Matrix (BE) | Gate |
|---------|-------------------|-------------------|----------------|------|
| **Platform** | [Platform-Acceptance-System.md](../acceptance/Platform-Acceptance-System.md) | [Platform-Product-Readiness-Matrix.md](../acceptance/Platform-Product-Readiness-Matrix.md) | [Platform-Implementation-Matrix.md](../acceptance/Platform-Implementation-Matrix.md) | `run-platform-stage-gate` |
| **Clinic** | [Clinic-Acceptance-System.md](../acceptance/Clinic-Acceptance-System.md) | [Clinic-Product-Readiness-Matrix.md](../acceptance/Clinic-Product-Readiness-Matrix.md) | [Clinic-Implementation-Matrix.md](../acceptance/Clinic-Implementation-Matrix.md) | `run-clinic-stage-gate` |
| **Hotel** | [Hotel-Acceptance-System.md](../acceptance/Hotel-Acceptance-System.md) | [Hotel-Product-Readiness-Matrix.md](../acceptance/Hotel-Product-Readiness-Matrix.md) | [Hotel-Implementation-Matrix.md](../acceptance/Hotel-Implementation-Matrix.md) | `run-hotel-stage-gate` |
| **Finance** | [Finance-Acceptance-System.md](../acceptance/Finance-Acceptance-System.md) | [Finance-Product-Readiness-Matrix.md](../acceptance/Finance-Product-Readiness-Matrix.md) | [Finance-Implementation-Matrix.md](../acceptance/Finance-Implementation-Matrix.md) | `run-finance-stage-gate` |
| **Bank** | [Bank-Acceptance-System.md](../acceptance/Bank-Acceptance-System.md) | [Bank-Product-Readiness-Matrix.md](../acceptance/Bank-Product-Readiness-Matrix.md) | [Bank-Implementation-Matrix.md](../acceptance/Bank-Implementation-Matrix.md) | `run-bank-stage-gate` |
| **Bank DBO** | [Bank-DBO-Acceptance-System.md](../acceptance/Bank-DBO-Acceptance-System.md) | [Bank-DBO-Product-Readiness-Matrix.md](../acceptance/Bank-DBO-Product-Readiness-Matrix.md) | [Bank-DBO-Implementation-Matrix.md](../acceptance/Bank-DBO-Implementation-Matrix.md) | `run-bank-dbo-stage-gate` |
| **F&B / Retail / CRM** | see `docs/acceptance/` | full matrices | full matrices | thin gate wrappers |
| **Logistics / Wholesale / Construction / Auto / Data Hub** | see `docs/acceptance/` | full matrices | full matrices | thin gate wrappers |

Index: [`docs/acceptance/README.md`](../acceptance/README.md). Config: [`kit-config.yaml`](../../kit-config.yaml).

---

## 7. Cursor / agent

**Scaffold-Green ≠ product acceptance.**  
**MODULES_CATALOG DONE ≠ edition `ga`.**  
**SHIPPED ≠ Pilot-ready.**

### Tooling

| Layer | Artifact |
|-------|----------|
| Rule | `.cursor/rules/task-acceptance.mdc` |
| Hooks | `.cursor/hooks.json` |
| Skills | `acceptance-closeout`, `quality-gates` |
| Consistency | `npm run check:acceptance` |
| Quality bundle | `npm run run:quality-gates` |

Agent does **not** replace CI. Human-on-loop remains for Pilot-ready / field.
