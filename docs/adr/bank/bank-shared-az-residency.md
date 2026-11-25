# ADR — Bank SHARED pool and Azerbaijan data residency (L10)

**Status:** DECLARED (requirements documented; implementation not IN)  
**Date:** 2026-11-25  
**Related:** [deployment-topology.md](../deployment-topology.md) · [01-az-regulatory.md](./01-az-regulatory.md) L10 · Inventory `CAP-NFR-TOPO`

## Context

ERA Bank targets the same **SHARED / DEDICATED / ONPREM** placement ladder as industry satellites. Row isolation uses `organizationId` + fail-closed kit filters (`CAP-NFR-TOPO` 🟡). Azerbaijan law and CBAR expectations require **personal and banking-secret data** to remain under AZ jurisdiction for retail CBS workloads [U].

## Decision

1. **Target:** a SHARED bank pool is allowed in product vocabulary, but **live SHARED with multi-tenant bank rows** is **DECLARED**, not shipped — same honesty as hotel/clinic tenant rows.
2. **Data residency (L10):** for AZ retail/universal CBS, primary Postgres replicas, backups, and operator access paths for customer PII and account data **must be located in Azerbaijan** (or in customer ONPREM iron). Cross-border replication of row-level bank PII without legal basis is out of scope.
3. **Encryption:** TLS in transit; at-rest encryption on DB volumes is required for production declarations; end-to-end field encryption for national identifiers follows MDM / orchestrator PII policy (bank engine stores `globalPersonId` only).
4. **Evidence before IN:** two-org isolation UAT on SHARED topology + written residency attestation for the hosting region. Until then Inventory stays **DECLARED**; do not sell «multi-tenant cloud bank» from topology alone.

## Consequences

- P2-7 is documentation + gate clarity only — no false `CAP-NFR-TOPO = IN`.
- DEDICATED / ONPREM remain valid near-term paths for a licensed bank while SHARED pool engineering completes.