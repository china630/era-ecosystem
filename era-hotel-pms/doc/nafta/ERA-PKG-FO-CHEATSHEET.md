# FO cheat-sheet — medical package (`ERA-PKG`)

Write the package in **Extra Request** (first lines). Do **not** rely on Rate Code.

## Single package (all guests)

```
ERA-PKG STANDART
```

Also: `PREMIUM`, `DERMO`, `DETOKS` (or `PKG-STANDART`, …).

## Mix by guest name (no 1./2. ordinals)

```
ERA-PKG
Aliyev: PREMIUM
Aliyeva: STANDART
```

## Agency shortcuts

| Agency label | SKU |
|--------------|-----|
| starts with `Premium` / `Premium paket Walkin` / `Premium Facebook` | PREMIUM |
| starts with `Dermo` / `Dermo paket Walkin` / Facebook Dermo | DERMO |
| starts with `Detox`/`Detoks` / Detox walk-in | DETOKS |
| Həmkarlar (any) | STANDART (still prefer `ERA-PKG STANDART`) |
| `Walkin leisure` | **not** a medical package |
| `Walkin medical` (no prefix) | staff picks on clinic |

## Share (two cards)

One `ERA-PKG` line **per reservation card**.

## Channel noise

Do not put room-type text (`Стандартный двухместный`) in Extra Req as the package.
