# ERA UI tokens (3-tier hybrid)

| File | Tier |
|------|------|
| `primitives.ts` | L1 - raw values (only place to author new hex) |
| `semantic.ts` | L2 - role aliases (no raw hex) |
| `components.ts` | L3 - Tailwind `*_CLASS` strings (hex must match L1) |
| `resolve-field.ts` | dataType -> width / align / filter control |
| `column-schema.ts` | columns -> table cells + list filters |

**Docs:** `DESIGN.md` (Three-tier design tokens), `docs/adr/era-design-tokens-3tier.md`  
**Lint:** `npm run lint:token-layers` from repo root  

Public import: `@era/satellite-kit/ui` (facade `../design-system.ts` re-exports L3).
