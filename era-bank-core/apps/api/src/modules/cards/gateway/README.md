# Card issuer gateway

## Default (lab)

`MockAzeriCardGateway` simulates registration, authorize, and capture for engine tests and ops UI.

## Live processing (blocked)

**P2-8:** live issuer authorization and clearing on AzeriCard / MilliKart testbenches is **blocked on partner** credentials, BIN sponsorship, and certification (YC-E2). `BANK_CARDS_MODE=live` fails closed until a live adapter replaces the mock.

See [03-external-blockers.md](../../../../../docs/adr/bank/03-external-blockers.md) and `era-bank-core/doc/OPEN-TASKS.md` § P1 card processor.