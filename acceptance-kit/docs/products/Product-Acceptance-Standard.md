# Product Acceptance Standard (canon)

**Version:** 1.0 (portable kit)  
**Status:** Template — adapt product names and paths  
**Consistency check:** `.\scripts\check-acceptance-consistency.ps1`  
**Agent rule:** `.cursor/rules/task-acceptance.mdc`

---

## 1. Why

At any time the team and product owner must see for **each** product:

1. **What was promised** (PRD / RFQ / AC-*)
2. **What was built** (code + test)
3. **Which stage** (wave / edition)
4. **How well it matches expectations** — only with proof

No “green in our heads”. Rule: **no log / CI artifact → no gate/`[x]`**.

**Invariants:**

1. scaffold-gate ≠ pilot / field sign-off  
2. stage `gate[x]` ≠ AC Scaffold ✅  
3. **AC Scaffold Matrix ≠ Product Readiness** (UI / demo / field)  
4. headers / PRD / signoff **must not** paint the product green over Readiness 🟡/❌  

---

## 2. Required stack (per product or major edition)

```
PRD (+ AC-*)
        ↓
Program / MVP-Spec                    ← header = Product Readiness rollup
        ↓
Sprint-Index (Gate | AC rollup | Pilot-ready)
        ↓
Stage specs (backlog ID, G1…G6)
        ↓
Implementation-Matrix                 ← SSOT **AC / Scaffold BE**
        ↓
Product-Readiness-Matrix              ← SSOT **product readiness** (one screen)
        ↓
Evidence-Rules
        ↓
scripts/run-<product>-stage-gate.ps1  (+ check-acceptance-consistency.ps1)
        ↓
Pilot-Readiness-Checklist + Pilot-Gap-List + Demo/TE sources
```

| Layer | Question |
|-------|----------|
| PRD | *What do we sell?* |
| Program Spec | *In which waves?* |
| Sprint-Index | *Gate / AC / Pilot?* |
| **Implementation-Matrix** | *Is the PRD AC closed on API/engine?* |
| **Product-Readiness-Matrix** | *Can we show / pilot / sell?* |
| Evidence-Rules | *May we ✅ / `ga`?* |
| Gap / Pilot / TE | *Proof for Readiness layers* |

---

## 3. Status legend

### 3.1. Three levels (do not mix)

| Level | Where | Marker | Meaning |
|-------|-------|--------|---------|
| **Gate** | Sprint-Index / stage-spec | `gate[x]` / `[~]` / `[ ]` | stage-gate log PASS |
| **AC Scaffold** | Implementation-Matrix | ✅ / 🟡 / `[ ]` | PRD intent + negative path |
| **Product ready** | Matrix Pilot-ready + editions | `[x]` / `[ ]` / ⏸ · `mvp`/`ga` | staging/field / edition |

Legacy: a lone `[x]` in Index is allowed **only** as synonym of `gate[x]` and **must** sit next to AC rollup and Pilot-ready columns.  
**Forbidden:** a single “Status `[x]`” column without level.

Backlog ID: `[ ]` · `[~]` · `[x]` (done with proof) · `[blocked]`.

### 3.2. Implementation-Matrix

| Column | Marker | Meaning |
|--------|--------|---------|
| **Scaffold** | ✅ / 🟡 / `[ ]` | Soft proof; not field |
| **Pilot-ready** | `[x]` / `[ ]` / ⏸ | Staging or field PASS / sign-off |

**Scaffold ✅ only if all of:**

1. Proof covers **PRD AC wording** (including negative path: spoof → 401/403, deny → stated effect, stub → explicit `mode=stub`).  
2. **Worst-component:** no sub-component of the same AC is 🟡 / `[ ]`.  
3. No open **Critical residual** in the same AC contour.  
4. AC is **not** field-intent (see below).

Otherwise → **🟡**, even with a green stage-gate.

**No soft-green on field AC:** if wording requires customer/prod/field — Scaffold max **🟡**; Pilot-ready stays `[blocked]` / `[ ]` until field.

Stage-gate `gate[x]` ≠ AC Scaffold ✅.

### 3.3. Edition honesty (`editions-*.yaml` or equivalent — only SSOT)

| status | When |
|--------|------|
| `roadmap` | No product-ready proof |
| `scaffold` | Skeleton without full gate |
| `mvp` | Unit/gate PASS; **not** field |
| `ga` | Pilot-ready + field / partner sign-off |

False `ga` without Pilot-ready is **forbidden**.  
Banned prose: `ga (partner)`, `ga (greenfield)` while yaml = `mvp`.

### 3.4. Two SSOTs (do not mix)

| SSOT | File | Question |
|------|------|----------|
| **AC / Scaffold** | `*-Implementation-Matrix.md` | Is the PRD AC closed (BE/API/engine)? |
| **Product Readiness** | `*-Product-Readiness-Matrix.md` | Is the **product** ready (UI, demo, pilot, sell)? |

```
Ask «матрица готовности» / readiness / sell/show
  → Product-Readiness-Matrix only (all columns).

Ask «Scaffold / AC / backend matrix»
  → Implementation-Matrix.
```

**Product Readiness — required columns:**

| Edition | Gate | Scaffold BE | UI* | Demo / TE* | Pilot lab | Pilot field | Edition | Sell / show |

`*` = required if the line has UX/demo; else `n/a` with reason.

```
Product_edition = worst(Gate, BE, UI*, Demo*, Pilot lab, Pilot field)
  order: [ ] / ❌ < 🟡 < ✅
  (⏸ external does not unlock green sell)

Forbidden:
  calling Implementation-Matrix «product readiness matrix»;
  «all ✅» / «product ready» when Product_edition ≠ ✅;
  answering readiness with Scaffold BE alone.
```

MVP-Spec / Index / PRD status copy **Product Readiness** rollup (or link to it).

### 3.5. Consistency (one PR)

When AC Scaffold **or** UI/TE/Pilot status changes — same PR:

1. Implementation-Matrix (if AC)  
2. **Product-Readiness-Matrix** summary  
3. Sprint-Index / MVP-Spec header  
4. Pilot-Gap / TE-Gap if needed  
5. Sales / RFQ copy if `ga` / “ready”

Check: `.\scripts\check-acceptance-consistency.ps1`.

---

## 4. Stage Gate (G1…G6) — template

| # | Check | Proof |
|---|-------|-------|
| G1 | Stage auto-tests | `run-<product>-stage-gate.ps1 -Stage <wave>` PASS |
| G2 | E2E (if any) | `reports/<product>-stage-<wave>-e2e.log` |
| G3 | Matrix updated; no prose «Matrix Scaffold ✅» if wave rollup is 🟡 | PR diff Matrix |
| G4 | Index: **gate[x]** + AC rollup from Matrix (not `all ✅`) | PR diff Index |
| G5 | editions (only if license/deploy) | license / manifest test |
| G6 | Signoff at gate level | `reports/<product>-stage-<wave>-signoff.md` = `scaffold-gate-pass`, not product-green if Pilot open |

Next wave does not start until previous **gate** = PASS (parallelism — per Index).

---

## 5. Task workflow

### Started

1. Backlog ID → `[~]`  
2. Matrix → Scaffold 🟡  

### Finished

1. Test / golden  
2. Stage-gate → `gate[x]` + log  
3. Matrix: ✅ only per §3.2; else 🟡; Pilot-ready only after staging/field  
4. Sync §3.5  
5. Editions yaml — only if edition/license changed  
6. `.\scripts\check-acceptance-consistency.ps1` — PASS  

### Before pilot / GA

Pilot checklist signed; Gap P0 closed or `[blocked]` with owner; edition `ga` only with Pilot-ready.

---

## 6. Product map → documents

<!-- Replace with your products -->

| Product | Acceptance-System | **Product Readiness** | **AC Matrix (BE)** | Gate |
|---------|-------------------|-----------------------|--------------------|------|
| **Product A** | `ProductA-Acceptance-System.md` | `ProductA-Product-Readiness-Matrix.md` | `ProductA-Implementation-Matrix.md` | `run-product-a-stage-gate` |
| **Product B** | `ProductB-Acceptance-System.md` | `ProductB-Product-Readiness-Matrix.md` | `ProductB-Implementation-Matrix.md` | `run-product-b-stage-gate` |

Templates: `docs/templates/`.

---

## 7. Cursor / agent

Update the Acceptance-System of **that** product (see `.cursor/rules/task-acceptance.mdc`).  
**Scaffold-Green ≠ product acceptance.**  
**«Матрица готовности» → Product-Readiness-Matrix, not Implementation-Matrix.**

### Tooling

| Layer | Artifact | Purpose |
|-------|----------|---------|
| Project rule | `.cursor/rules/task-acceptance.mdc` | Matrix SSOT + consistency |
| Hooks | `.cursor/hooks.json` | block force-push / hard reset; stop-closeout |
| Skill | `.cursor/skills/acceptance-closeout/` | task closeout |
| Skill | `.cursor/skills/quality-gates/` | consistency (+ host-repo gates) |
| Consistency | `scripts/check-acceptance-consistency.ps1` | CI job recommended |

Agent does **not** replace CI. Human-on-loop remains for Pilot-ready / field.
