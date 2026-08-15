# Bank DBO TE demo signoff — YC-C2

- Product: bank-dbo
- Wave: YC-C2 TE pack
- Date: 2026-08-06
- Result: te-pack-ready

## Scripted path (lab)

1. Login retail OTP (dev code) → dashboard
2. Accounts → transfer
3. Payment create → sign → list
4. Corporate approve queue (dual-sign)
5. ASAN stub path with stub badge on `/login`
6. Negative: bad OTP; insufficient funds; dual-sign incomplete
7. Standing orders create + pause (`/standing-orders`)
8. Loan application draft → submit (`/loans/apply`) — no book
9. 3DS challenge complete (`/cards/3ds`)
10. Islamic contracts read-only (`/islamic`)
11. Negative: SO/loan without auth → 401

## Honesty

Demo/TE ✅ for lab pack only. ASAN remains stub (YC-E3). Not Pilot field / not ga.
