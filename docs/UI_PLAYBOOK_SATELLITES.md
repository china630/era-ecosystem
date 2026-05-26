# UI playbook — industry satellites

Target: **list/table screens** + **modal CRUD** aligned with [DESIGN.md](../DESIGN.md) and `@era/satellite-kit/ui`.

## Layout

- Root layout: `APP_SHELL_CLASS` from `@era/satellite-kit/ui`
- Optional: `PlatformSessionBarServer` for Finance / Orch deep links
- Page header: `PageHeader` component

## CRUD pattern

1. **Index route** — table of entities, primary action “Add” opens modal
2. **Modal** — `ModalShell` + form; POST/PATCH to `/api/...`
3. **Delete** — confirm in modal footer (`ModalFooter`)
4. **No full-page create** for admin entities (ops flows like POS floor may stay full-screen)

## Reference implementations

| App | Example |
|-----|---------|
| Finance | `apps/web/components/sales/modals/CreateCounterpartyModal.tsx` |
| Hotel | `src/components/EraModal.tsx`, `app/admin/master-data/page.tsx` |
| Retail (SP9 pilot) | `app/settings/page.tsx` — outlet name edit in modal |

## Checklist per app admin area

- [ ] Uses `CARD_CONTAINER_CLASS` + `DATA_TABLE_CLASS` tokens
- [ ] Create/edit in modal, not dedicated `/new` page
- [ ] Errors shown inline in modal (not alert)
- [ ] i18n keys if app has locale files

## Out of scope

- Copying full Finance ERP density to satellites
- Orch web super-admin (separate shell — see [orch-admin-shell.md](./adr/orch-admin-shell.md))
