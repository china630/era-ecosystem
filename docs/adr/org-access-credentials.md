# ADR: Organization access keys

Accepted. The platform org card has an **Access** tab. The organization stores its own connector identifiers and secrets there. Bank and government API base URLs stay in the platform catalog (`org-access-catalog.ts`). The organization does not type those URLs.

1C is the exception: each company publishes its own base, so `baseUrl` is an org field.

Unibank, Access Bank, and Bank of Baku are listed and inactive until a platform adapter exists. Saving them returns `CONNECTOR_INACTIVE`.

Secrets are encrypted with `encryptText` and are not returned on list or save. The audit row records the connector code, public fields, and whether a secret was set or replaced — never the secret itself. Check (`POST …/access/:code/check`) reports `stored` and `calledExternal: false`. Finance calls `GET /internal/v1/organizations/:id/access/:code` with the service token. Bank adapters (PASHA, ABB, Birbank) use that secret for the org and keep API URLs on the process. Missing key is `BANK_ORG_ACCESS_MISSING` and does not call the bank. ƏMAS submit sends the employer id and secret only when `EMAS_SUBMIT_URL` is set; otherwise the existing 503 remains. e-taxes / e-qaimə prefer `GOV_ETAXES` ASAN ID and still fall back to a previously stored settings value. The finance settings screen no longer writes ASAN ID. Customs, migration, and DSMF are readable through `OrgAccessClient` and are not submitted. Unibank, Access Bank, and Bank of Baku stay inactive.

## Consequences

- Table `organization_access_credentials`, unique `(organization_id, connector_code)`.
- Coverage `ORCH-ACCESS-01` is API (screen exists, live portals are not called).
- AC-CP-ACCESS stays 🟡 and out of the Platform BE rollup until a negative HTTP suite exists. The service spec covers inactive refuse, cipher storage, and check-without-call.
