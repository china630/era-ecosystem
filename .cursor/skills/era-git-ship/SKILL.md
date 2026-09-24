---
name: era-git-ship
description: >-
  Ordered git commits and PR workflow for ERA ecosystem (orchestrator → data-hub → MDM → rest),
  plus per-core and per-satellite commits. Use when the user says полный коммит, коммит всех
  сателлит, сделай шип, шип и пуш, шип + пуш, шип оркестратор, собери образы,
  задеплой, пуш на гит, коммит оркестратор/data-hub/mdm/finance/hotel/clinic,
  PR на dev, merge master, or era-git-ship. Before every push: local ship gates
  (`npm run ship:prepush`); on FAIL fix and do not push.
---

# ERA git-ship — ordered commit + PR workflow

## Triggers (Russian / English)

| User says | Action |
|-----------|--------|
| **полный коммит**, **коммит всех сателлит**, **full commit**, **era-git-ship full** | Full wave (4 commits) + **local ship gates** + push + PR → dev → wait CI green → merge + PR dev → master → wait CI → merge |
| **сделай шип**, **шип и пуш**, **шип + пуш**, **пуш на гит**, **ship and push** | Same as full wave if there are uncommitted changes; if tree is already committed, **gates then PublishDev** (and master after CI) |
| **шип оркестратор** / **шип+пуш оркестратор** (or hotel, clinic, finance, …) | **Scoped ship:** commit that scope → `-PublishDev -WaitStaging` (wait CI → merge → Build images → Deploy staging). **Do not** promote `master` unless the user said so. **Do not** stop at an open PR URL. Path-filter rebuilds only matching GHCR services — do not dispatch a full 16-image build. |
| **собери образы оркестратор** (or `hotel`, `clinic`, …) | Manual `era-ship.ps1 -PublishImages -Services <ghcr>` (only if auto path-filter did not run) |
| **задеплой оркестратор** | Manual `era-ship.ps1 -PublishDeploy -DeployScope orchestrator -ImageTag <tag>` |
| **коммит оркестратор** / **orch commit** | Single scope `orchestrator` commit only (no PR unless also asked to push) |
| **коммит data-hub** / **дата-хаб** | Single scope `data-hub` |
| **коммит mdm** / **мдм** | Single scope `mdm` |
| **коммит finance** / **финансы** | Single scope `finance` |
| **коммит bank** / **bank-core** | Scopes `bank` or `bank-core` |
| **коммит hotel** / **clinic** / **wholesale** / … | Named satellite scope (see manifests) |
| **pr на dev** / **merge dev** | **Gates**, then publish only (after commits exist) |
| **pr на master** / **promote master** | Quality-gates only, then PR dev → master + merge after CI |

Always read [manifests.yaml](manifests.yaml) for path buckets.
Always read [quality-gates](../quality-gates/SKILL.md) before any `git push`.

## Preconditions

1. **Never commit:** `docker-data/`, `.env`, `.cursor/plans/`, `node_modules/` — see `never_commit` in manifests. **Do** commit tracked `.cursor/rules/*.mdc` and `.cursor/skills/**` when the user asked to update them (`-Wave` allows those two prefixes).
2. **Do not edit** `.cursor/plans/*` unless user explicitly asks.
3. **Git safety:** follow user git rules — no force push, no skip hooks, commit only when user asks (these triggers **are** explicit commit requests).
4. **Branch protection:** `dev` and `master` require **PR + CI** — never `git push origin dev` directly.
5. **gh auth:** `git push` uses Git Credential Manager; `gh` needs `GH_TOKEN`. If unset, run `Ensure-GhAuth` pattern from [docs/GH_CLI_SETUP.md](../../../docs/GH_CLI_SETUP.md) (auto in `era-ship.ps1`). Past chat tokens are **not** persisted across agent sessions.
6. **PowerShell:** use `;` not `&&`. Commit messages: `-m "title" -m "body"` (no HEREDOC on Windows).
7. **No emergency reset:** never `git checkout origin/dev -- <app>/` (or equivalent) to discard a conflicting wave so CI goes green. Fix cleanly or split into a separate PR. See `.cursor/rules/era-no-emergency-reset.mdc`.
8. **Local ship gates before every push** (not before each commit). Prisma migrate / `docker compose` health is **not** a substitute. See [Local ship gates](#local-ship-gates-before-push) below. Never pass `-SkipGates` / `ERA_SHIP_SKIP_GATES=1` unless the user explicitly asked to skip gates.

## Local ship gates (before push)

**When:** immediately before `git push`, `-PublishDev`, or `-PublishMaster`. **Not** on every `git commit` in a multi-commit wave.

**Command (repo root):**

```powershell
npm run ship:prepush
# strict acceptance (SHIPPED / PR):
npm run ship:prepush:strict
```

This runs:

1. `npm run run:quality-gates` (acceptance, satellite raw SQL, integration audit, design tokens, **baku clock**).
2. Rebuild dirty `packages/*` in CI order if the diff touches them.
3. **Scoped** checks from `git diff origin/dev...HEAD` (+ working tree):
   - each touched `era-hotel-pms` / clinic / … / `era-bank` / `era-bank-dbo`: `prisma generate` (if schema), `npm test`, `npm run build`
   - `era-finance-core`: `validate:no-nas-literals` + `test:integration -w @erafinance/api -- --ci`
   - `era-orchestrator`: `db:generate` + `test:api`
   - `era-data-hub`: `test -w @era/data-hub-api`
   - `era-bank-core`: `npm test -- --ci` + `npm run build`

**On FAIL:** do **not** push. Fix the code, make a **new** commit (no amend unless user git rules allow), re-run `npm run ship:prepush`, then push. Repeat until PASS.

**PASS is not the push gate.** `db:generate` / `prisma generate` / `npm run build` rewrite tracked `generated/` and `runtime-cjs`. After PASS:

1. `git status` — ignore only `never_commit` (`tmp/`, `docker-data/`, `.env`, …).
2. If anything else is dirty: **new commit** (same wave prefixes), **clear `ERA_SHIP_GATES_DONE`**, re-run `npm run ship:prepush`.
3. Push / `-PublishDev` only when the tree is clean except `never_commit`.

`ERA_SHIP_GATES_DONE=1` skips re-running tests in the same session, but **`era-ship-prepush.mjs` still fails if the tree is dirty** (so a git hook cannot push generate leftovers). Never set the flag while porcelain remains except `never_commit`. `era-ship.ps1` also throws on a dirty tree.

**Manual `git push` is not a bypass:** the pre-push hook runs the same script. Option B must still end on a clean tree.

**Does not replace GitHub CI.** After push, wait for Actions green, then `gh pr merge --merge` **with the PR number**. Local gates will not catch every Ubuntu-only failure; they catch the class that burned PR #85 (tokens, NAS literals, satellite Jest/`next build`).

**Not in local ship gates (still CI-only):** orchestrator Next `apps/web` production build, finance-web `next build`. A workforce TSX bug can be red on GitHub after local `test:api` PASS.

**Hooks:** `node scripts/install-era-git-hooks.mjs` copies `.githooks/pre-push` → `.git/hooks/pre-push`. `era-ship.ps1 -PublishDev` installs this if missing. Raw `git push` then runs the same script. Do not set `git config` (user rule).

**Skip:** only if the user said so: `-SkipGates` on `era-ship.ps1` or `ERA_SHIP_SKIP_GATES=1`. After a successful `Invoke-ShipPrepush`, the script sets `ERA_SHIP_GATES_DONE=1` so the git hook does not run the same gates twice.

**Master promote:** `node scripts/era-ship-prepush.mjs --quality-only` (no scoped `next build` of the entire `dev` vs `master` delta).

## Full wave — commit order

```
orchestrator → data-hub → mdm → rest (all satellites, finance, bank, platform, docs)
```

**Topology / `organizationId` waves** ([deployment-topology.md](../../../docs/adr/deployment-topology.md)): do **not** one-PR kit + all satellites + orch placement + Nafta compose. Order: kit/ADR → **one satellite** schema → orchestrator desired-state/placement → finance SSO/config. Nafta appliance deploy ≠ SHARED pool deploy.

### Option A — script (preferred on Windows)

From repo root:

```powershell
git checkout -b integration/ecosystem-wave-<slug>   # if not already on feature branch

.cursor/skills/era-git-ship/scripts/era-ship.ps1 -Wave -Subject "ecosystem integration wave" -Body "See COVERAGE_MATRIX and audit scripts."

.cursor/skills/era-git-ship/scripts/era-ship.ps1 -PublishDev -Head (git branch --show-current) -Title "feat: ecosystem integration wave" -Body "Ordered: orchestrator, data-hub, MDM, satellites."
# PublishDev: ship:prepush → **clean tree** → push → PR → wait checks → merge. Does NOT exit on --auto alone.
# Throws if generate/build left a dirty tree. For «на сервер» / scoped ship to droplet, add -WaitStaging.

# After dev PR merged and CI green (and only if user asked for master):
git checkout dev; git pull origin dev
.cursor/skills/era-git-ship/scripts/era-ship.ps1 -PublishMaster -Head dev
```

Dry-run: add `-DryRun` to any command.

### Option B — agent manual steps

1. `git status` + `git diff` — confirm no secrets, list changed paths.
2. Create/checkout branch `integration/<wave-slug>`.
3. For each wave bucket in order, `git add` paths from manifests, commit with prefix from manifest.
4. **Shared package index splitting** (when `packages/era-contracts/src/index.ts` or `packages/satellite-kit/src/index.ts` span waves):
   - **data-hub commit:** export `reference-data` only; kit exports for calendar/fx/reference-catalog/financeFxPreview; ui index: `FxEquivalentBadge` only.
   - **mdm commit:** add `mdm` export; kit mdm exports + `VoenLookupField` in ui index.
   - **rest commit:** remaining kit/orchestrator/session/platform exports.
5. Skip empty buckets (no matching changed files).
6. Prefer `era-ship.ps1 -Wave` over hand-picked `git add` so MDM (`era-orchestrator/packages/mdm-database/`, `*/src/**/mdm/**`) is not swallowed by the orchestrator prefix. Longest path wins.
7. **Local ship gates:** `npm run ship:prepush`. FAIL → fix → new commit → re-run.
8. **Working tree clean** (except `never_commit`). If generate/build dirtied files → new commit → unset `ERA_SHIP_GATES_DONE` → re-run gates. Do **not** push a dirty tree.
9. Push + PR (PublishDev). Wait for **GitHub CI** green, then merge **that PR number**. Then PublishMaster after that CI is green. Never `gh pr view` without a PR number. Never treat `gh pr checks --watch` SUCCESS on a SHA that already passed on `dev` as enough to merge `dev`→`master` — retry `gh pr merge <n>` until branch protection accepts (queued `packages` / policy), or fail on real red checks.

## Single scope commit

```powershell
.cursor/skills/era-git-ship/scripts/era-ship.ps1 -Scope hotel -Subject "folio FX preview and voen BFF"
```

Or agent: stage only paths under `era-hotel-pms/` (+ touched shared files if hotel-only feature requires them in same commit).

Satellite scope names: `hotel`, `clinic`, `wholesale`, `logistics`, `construction`, `crm`, `auto-service`, `fnb-pos`, `retail-pos`.

Core scope names: `orchestrator`, `data-hub`, `mdm`, `finance`, `bank-core`, `bank`, `packages`, `platform`.

List all: `era-ship.ps1 -ListScopes`

## Scoped images + deploy (after merge to `dev`)

Path-filter lives in [`scripts/ci-changed-ghcr-services.mjs`](../../../scripts/ci-changed-ghcr-services.mjs). Push to `dev`/`master` rebuilds only touched GHCR services; deploy pulls those compose services (`DEPLOY_SERVICES`), not the whole stack — except when compose / install-contract / droplet scripts change: then `deployScope=all` with **floating** `IMAGE_TAG` (`dev`/`master`) so unbuilt services do not 404 at a new sha tag. `docker/scripts/satellite-entrypoint.sh` force-rebuilds all satellite images (copied into `Dockerfile.satellite`).

**CI (`ci.yml`) is not path-filtered.** A hotel-only merge still runs the full test matrix (`finance`, all satellites). That is tests, not a finance image rebuild. Scoped GHCR is `Build and push images` / `Deploy staging` only.

**Do not** `gh workflow run` a full image build after a scoped merge — wait for the automatic run.

Manual override (rebuild/redeploy without a new push):

```powershell
.cursor/skills/era-git-ship/scripts/era-ship.ps1 -PublishImages -Services orchestrator -Head dev
.cursor/skills/era-git-ship/scripts/era-ship.ps1 -PublishDeploy -DeployScope orchestrator -ImageTag dev -Head dev
```

Skill scope → GHCR `services=` / deploy `scope`:

| Skill `-Scope` | `-PublishImages -Services` | `-PublishDeploy -DeployScope` |
|----------------|----------------------------|-------------------------------|
| `orchestrator` / `mdm` | `orchestrator` | `orchestrator` |
| `data-hub` | `data-hub` | `data-hub` |
| `finance` | `finance-core,finance-web` | `finance` |
| `hotel` | `hotel-pms` | `hotel` |
| `clinic` | `clinic` | `clinic` |
| `fnb-pos` | `fnb-pos` | `fnb` |
| `packages` | _(empty = all)_ | `all` |

`workflow_run` **Deploy staging** is read from the **default branch** (`master`). A path-filtered build on `dev` is only safe after this wiring (including `IMAGE_TAG_MODE` floating for compose-only) has been merged to `master`.

## PR → dev → merge

```
git push -u origin HEAD
```

**Required first:** `npm run ship:prepush` (or `era-ship.ps1 -PublishDev`, which runs it). FAIL → no push.

Then:

Preferred (blocks until merged; use `-WaitStaging` when user expects the droplet):

```powershell
.cursor/skills/era-git-ship/scripts/era-ship.ps1 -PublishDev -Head <branch> -Title "..." -Body "..." -WaitStaging
```

Manual equivalent:

```powershell
gh pr create --base dev --head <branch> --title "..." --body "..."
# parse /pull/N from the URL
gh pr checks <n> --watch
gh pr merge <n> --merge
# if policy / queued required check: retry merge; do not --admin
# then wait Build and push images + Deploy staging on the merge SHA
```

**Hard rule for agents:** creating a PR is not done. `--auto` alone is not done. Turn ends only after merge (and after staging when user said «на сервер» / scoped ship). This repo often rejects `enablePullRequestAutoMerge`. Never merge a red PR.

PR body should mention:
- commit order (orchestrator → data-hub → MDM → rest)
- audit scripts if touched: `node scripts/audit-reference-data.mjs`, `node scripts/audit-mdm-identity.mjs`
- migrations if any (`prisma migrate deploy` per app)

## PR dev → master → merge

Only after dev PR merged and checks green:

```powershell
git fetch origin dev master
gh pr create --base master --head dev --title "release: promote dev — <wave name>"
# capture /pull/N from the URL — do not `gh pr view` with no args
gh pr merge <N> --merge
# if "policy prohibits" / required check queued: wait and retry merge; do not --admin
```

## Commit message format

```
<prefix from manifests>: <short subject>

<optional body — why, not file list>
```

Examples:
- `feat(orchestrator): pricing seeds and super-admin UX`
- `feat(data-hub): FX/calendar clients and consumer audit`
- `feat(mdm): person identity contracts and merge BFF`
- `feat(hotel): folio FX preview and voen lookup BFF`
- `feat(ecosystem): satellite gaps closure and COVERAGE_MATRIX`

## v3 Workforce wave (Plan E)

When shipping **Plans A–E** (clean cutover, no partial legacy):

**Order (override default wave buckets for workforce-only release):**

1. `packages/era-contracts` + `packages/satellite-kit` — workforce events, policy client, MDM batch
2. `era-orchestrator` — CP workforce modules (absence, org, roles, provision) + web `/workspace/workforce/*`
3. `era-finance-core` — mirror consumers, slim Employee, demoted HR CRUD
4. Satellites — `era-clinic`, `era-fnb-pos`, `era-hotel-pms` provision handlers + policy guards
5. Root `docs/` + `scripts/audit-*` + `tools/bootstrap-local.mjs`

**Gate:** Do not merge step 4 without step 1–3 E1 legacy removal (`cp_workforce` only; no `finance_hr`/`local_master`; Finance must not emit `STAFF_PROVISIONED`).

**Pre-merge CI:**

```powershell
node scripts/v3-workforce-smoke.mjs
npm run audit:integration:strict
```

Runbook: [docs/runbooks/v3-workforce-cutover.md](../../../docs/runbooks/v3-workforce-cutover.md) · Master ADR: [cp-core-workforce-hub.md](../../../docs/adr/cp-core-workforce-hub.md)

## Agent checklist (full commit)

```
- [ ] git status — no secrets, no docker-data
- [ ] Branch integration/<slug> created
- [ ] Commit 1 orchestrator (if changed)
- [ ] Commit 2 data-hub (if changed)
- [ ] Commit 3 mdm (if changed)
- [ ] Commit 4 rest (remaining — including kit/docs/platform; no leftover porcelain except `never_commit`)
- [ ] `npm run ship:prepush` PASS (or FAIL → fix → new commit → re-run)
- [ ] If generate/build dirtied the tree: new commit, clear `ERA_SHIP_GATES_DONE`, re-run gates
- [ ] Working tree clean except `never_commit` (**this** is the push gate, not PASS alone)
- [ ] git push -u origin <branch>
- [ ] gh auth OK
- [ ] PR → dev created
- [ ] PR → dev merged (**GitHub CI green** — local gates are not enough)
- [ ] PR dev → master created (explicit PR number)
- [ ] PR → master merged (CI green on **this** PR; retry merge if protection still queued)
```

## Failure handling

| Error | Action |
|-------|--------|
| Local `ship:prepush` FAIL | Fix; **new** commit; re-run gates; do not push |
| Gates PASS but `git status` dirty | **New** commit of generate/build output; clear `ERA_SHIP_GATES_DONE`; re-run gates; do not push |
| GitHub CI red after push | Diagnose job logs; fix; **new** commit; push; wait again. No emergency reset. |
| `gh auth login` required | Stop; user must authenticate; give PR compare URL |
| `push declined` branch rules | Never push to dev/master directly; use PR |
| Empty scope bucket | Skip commit for that bucket |
| `enablePullRequestAutoMerge` rejected | Expected — `PublishDev` waits checks then `gh pr merge` without relying on `--auto` |
| `gh pr merge` policy / check queued | Wait and retry that PR number; do not `--admin`; do not merge on stale `checks --watch` green |
| `gh pr view` without PR number | Bug — parse `/pull/N` from `gh pr create` / `gh pr list` |
| Build images Docker Hub timeout | `-WaitStaging` reruns failed jobs once; if still red, diagnose Actions log |
| Agent turn ends on open PR | Bug — re-run `-PublishDev` (reuses open PR) or merge + `-WaitStaging`; do not ask user to click merge |
| Shared index spans waves | Split per "Shared package index splitting" above |
| Unbucketed files after `-Wave` | Bug — rest must take leftovers; check path slashes / manifests |
| `ERA_SHIP_GATES_DONE=1` + dirty tree | prepush **FAIL** (hook and `npm run ship:prepush`); commit leftovers |
| Staging wait matches old success | Script only accepts deploy completed in the last ~12 minutes; if unsure, open Actions |
| Pre-commit hook fail | Fix issues; **new** commit (never amend unless user rule allows) |

## Related docs

- Path buckets: [manifests.yaml](manifests.yaml)
- Quality gates: [quality-gates SKILL](../quality-gates/SKILL.md)
- Ports/env: [docs/ECOSYSTEM_URLS.md](../../../docs/ECOSYSTEM_URLS.md)
- Coverage honesty: [era-coverage-definition.mdc](../../rules/era-coverage-definition.mdc)
- Local runbook: [docs/SETUP_AND_RUN.md](../../../docs/SETUP_AND_RUN.md) §11
