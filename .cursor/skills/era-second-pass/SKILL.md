---
name: era-second-pass
description: >-
  Second pass over work just finished in this chat: find thin, forgotten, and
  sibling-surface gaps. Use when the user says найди пропуски, закрой пропуски,
  второй проход, повторная проверка, повторный аудит, тонкие места, забытые
  места, or era-second-pass. «найди пропуски» is report only. «закрой пропуски»
  and any phrase that includes «почини» is find and fix. Do not run this unless
  the user asked for that pass.
---

# ERA second pass

Re-read the change that just landed in this chat. Look for thin spots and places the first pass forgot. Do not restart the task and do not review the whole repo.

This is not `quality-gates`, `acceptance-closeout`, or `era-git-ship`. Do not run those unless a gap you found is exactly their job.

## Modes

| User says | Mode |
|-----------|------|
| **найди пропуски**, **второй проход**, **повторная проверка**, **повторный аудит**, **тонкие места**, **забытые места** (no «почини») | **Report.** List gaps. Do not edit files. |
| **закрой пропуски**, or the same phrases **plus «почини»** (including «найди и почини») | **Fix.** Repair gaps that belong to this change, then report what changed and what you left. |

If both a report-only phrase and «почини» / «закрой» appear, **Fix** wins.

## Scope

1. Take the work from this conversation: files edited, behavior changed, APIs and screens touched.
2. Read the current diff for those files (`git diff` and untracked files that are part of the task). Ignore unrelated dirty files.
3. From each changed symbol, search callers, siblings, and the other language files. Stop at one hop unless a hit shows the same bug again.

## What to hunt

Check only rows that the change could have missed:

- **Sibling surface.** Same field or action on another screen, modal, create vs edit, list vs detail, admin vs ops. A fix on one writer/reader while the other still uses the old shape.
- **i18n trio.** User-visible copy in `en` / `az` / `ru`. Key added in one file only, hardcoded string, or a key removed while still referenced.
- **Call sites and types.** Stale arguments, a newly required field, a return shape callers still unwrap the old way, dead branch left by the edit.
- **Empty and edge paths.** Null, empty list, void, inactive/retired catalog row, permission denied, partial save. The happy path already works; these are the misses.
- **Schema pair.** Prisma field without a migration, or a migration without the schema field. New column with no backfill where existing rows would be wrong.
- **Docs that this change made false.** Module-map route, a sentence in the owning PRD/TZ/ADR. If sell/show or SHIPPED status changed and was not updated, name that gap; run `acceptance-closeout` only in **Fix** mode when that update is part of closing it.
- **Tests that now lie.** An existing test still asserts the old behavior. Do not add a new suite as a drive-by.

Skip style nits, drive-by refactors, and pre-existing issues outside the change. Mention a pre-existing neighbor only when the new code calls it and will misbehave.

## Fix mode

1. Patch the gaps you listed. Stay inside this change.
2. Re-read the patch once for a gap the fix itself created (missed locale, missed caller).
3. New files: UTF-8, no BOM (see `era-utf8-encoding`).
4. If the fix changes a screen the user can click, verify that flow in the browser before finishing. If browser tools are unavailable, say what you could not click.
5. Do not commit unless the user asked.

## Report

Russian, short. Lead with the mode (`только отчёт` or `закрыто`). Then:

- **Сделано** — one line on what the original change was.
- **Находки** — each item: file, what is wrong, **исправлено** or **оставлено** and why.
- **Чисто** — if the hunt found nothing in scope, say that in one line. Do not invent findings.

No severity theater and no restatement of the whole diff.
