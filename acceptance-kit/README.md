# Acceptance Kit (portable)

Обезличенный шаблон приёмки продуктов для любого репозитория (Cursor + docs + consistency script).

**ERA Ecosystem install:** канон и runtime живут в репо:

| ERA path | Role |
|----------|------|
| [`docs/products/ERA-Acceptance-Standard.md`](../docs/products/ERA-Acceptance-Standard.md) | Canon |
| [`docs/acceptance/`](../docs/acceptance/) | Per-product matrices |
| [`docs/editions/`](../docs/editions/) | Edition honesty yaml |
| [`kit-config.yaml`](../kit-config.yaml) | Product paths |
| `npm run check:acceptance` | Consistency (CI) |
| `.cursor/rules/task-acceptance.mdc` | Agent routing |

Эта папка `acceptance-kit/` остаётся **portable upstream** для копирования в другие репозитории.

**Не привязан к ERA** как шаблон. Имена продуктов, пути матриц и editions — настраиваются.

## Что внутри

| Путь в kit | Куда копировать в целевой репо |
|------------|--------------------------------|
| `cursor/hooks.json` | `.cursor/hooks.json` |
| `cursor/hooks/*.mjs` | `.cursor/hooks/` |
| `cursor/rules/*.mdc` | `.cursor/rules/` |
| `cursor/skills/*/` | `.cursor/skills/` |
| `scripts/check-acceptance-consistency.ps1` | `scripts/` |
| `docs/products/Product-Acceptance-Standard.md` | `docs/products/` (или ваш путь) |
| `docs/templates/*` | скопировать → переименовать под каждый продукт |
| `kit-config.example.yaml` | → `kit-config.yaml` в корне kit или репо (для install) |

## Быстрый старт

1. Скопируйте папку `acceptance-kit/` куда угодно (или клонируйте только её).
2. Отредактируйте `kit-config.yaml` (см. example): продукты, пути матриц, banned `ga` yaml.
3. Из корня **целевого** репозитория:

```powershell
pwsh -NoProfile -File path\to\acceptance-kit\scripts\install-acceptance-kit.ps1 -TargetRepo .
```

Или скопируйте файлы вручную по таблице выше и подставьте имена продуктов в:

- `.cursor/rules/task-acceptance.mdc`
- `docs/products/Product-Acceptance-Standard.md` §«Карта продуктов»
- `scripts/check-acceptance-consistency.ps1` (блок `$required` / `$editionGaForbid`)

4. Для каждого продукта из `docs/templates/` создайте:
   - `<Product>-Acceptance-System.md`
   - `<Product>-Implementation-Matrix.md` (AC / BE)
   - `<Product>-Product-Readiness-Matrix.md` (готовность)
   - `<Product>-Evidence-Rules.md` (опционально)
5. Откройте репо в Cursor. Нужен **Node.js** в PATH (hooks на `.mjs`).
6. Проверка:

```powershell
pwsh -NoProfile -File scripts/check-acceptance-consistency.ps1
```

## Идея стандарта (кратко)

Два SSOT — не смешивать:

1. **Implementation-Matrix** — закрыт ли PRD AC (backend / API / engine).
2. **Product-Readiness-Matrix** — можно ли показывать / пилотировать / продавать (Gate, BE, UI, Demo, Pilot, Edition, Sell).

Запрос «матрица готовности» → только Readiness.  
Scaffold ✅ только с negative path + без Critical residual; field-AC максимум 🟡.  
Нет лога / CI artifact — нет `gate[x]`. Запрещены prose `all ✅` / ложный `ga`.

Подробности: `docs/products/Product-Acceptance-Standard.md`.

## Требования

- Cursor с project hooks (не disabled)
- PowerShell 7+ или Windows PowerShell 5.1 для скриптов
- Node.js для hooks

## Версия kit

**1.0** — вынесено из практики Product Acceptance Standard v1.3 (обезличено).
