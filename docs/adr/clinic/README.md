# ERA Clinic — ADR index

**Home for clinic / sanatorium clinical ADRs** (`era-clinic`). Platform / cross-satellite ADRs stay flat in [`docs/adr/`](../).

**Living implementation tracker:** [clinic medical full plan](../../../.cursor/plans/) (`clinic_medical_full_*.plan.md`)  
**Acceptance:** [`Clinic-Acceptance-System.md`](../../acceptance/Clinic-Acceptance-System.md) · Implementation / Product-Readiness / Sprint-Index under `docs/acceptance/Clinic-*`.  
**Edition:** [`docs/editions/clinic.yaml`](../../editions/clinic.yaml)  
**HTTP cutover:** [`clinic-nest-native-controllers.md`](./clinic-nest-native-controllers.md) · [`era-clinic/doc/nest-cutover.md`](../../../era-clinic/doc/nest-cutover.md)

## Reading order

| File | Role | Status |
|------|------|--------|
| [00-gap-vs-mis-benchmarks.md](./00-gap-vs-mis-benchmarks.md) | Gap vs MEDODS/Medesk/Cliniko + hospital + sanatorium benchmarks | Canon (analysis) |
| [01-az-regulatory.md](./01-az-regulatory.md) | İTS, e-Tabib, Rəqəmsal resept, e-Epikriz | Canon (analysis) |
| [02-remediation-backlog.md](./02-remediation-backlog.md) | MED-P0/P1/P2 backlog + acceptance criteria | Plan mirror |
| [clinic-clinical-notes.md](./clinic-clinical-notes.md) | Visit protocols (EMR-lite) | Accepted (MED-P0-02 scaffold) |
| [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) | D1–D4 one satellite, presets | **Accepted** |
| [sanatorium-vnext.md](./sanatorium-vnext.md) | Sanatorium clinical engine | Accepted |
| [clinic-nest-native-controllers.md](./clinic-nest-native-controllers.md) | Domain HTTP = Nest native controllers | **Accepted** |
| [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) | FIFO / peak / confirm | Accepted |
| [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md) | 5-min time layers | Accepted |
| [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) | Episode as care course | Accepted |
| [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md) | Variant A RBAC | Accepted |
| [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) | Pattern A/B | Accepted |
| [clinic-icd10-catalog.md](./clinic-icd10-catalog.md) | ICD / XBT | Accepted |
| [clinic-clinical-notes.md](./clinic-clinical-notes.md) | EMR-lite visit protocols | Accepted |
| [clinic-inpatient-mvp.md](./clinic-inpatient-mvp.md) | Inpatient HIS MVP foundation | Accepted |
| [clinic-inpatient-deferred-waves.md](./clinic-inpatient-deferred-waves.md) | Inpatient PR-2…PR-4 / MAR UI remainder | Deferred tracker |
| [clinic-its-insurance-adapters.md](./clinic-its-insurance-adapters.md) | İTS/DMS adapters manual\|api | Accepted |
| [clinic-telehealth-jitsi.md](./clinic-telehealth-jitsi.md) | Video rooms (Jitsi default) | Accepted (scaffold) |
| [clinic-portal-v2.md](./clinic-portal-v2.md) | Patient portal token session | Accepted (partial) |
| Remaining `clinic-*.md` / `nafta-*.md` | Domain accepted ADRs | Accepted |

## Stubs at old paths

Root files under `docs/adr/` that previously held this content are **stubs** pointing here (all moved `clinic-*`, `nafta-*`, `sanatorium-vnext.md`, plus `medical-satellite-gap-analysis.md` → 00/01/02).

## Locked architecture decisions (summary)

- One clinical satellite `era-clinic`; no separate `industry_hospital` (D1).
- Operation presets: `outpatient` / `inpatient_day` / `sanatorium_clinical` / `wellness`.
- Sanatorium business = hotel + clinic compose, not a third MIS.
- Domain HTTP lives in `era-clinic/nest/native/controllers` registered via `ClinicNativeModule`; `nest/generated` is gone.
- Kit bind / runtime-config / billing-status = `ClinicKitController`; guest-care = `GuestCareController`.
- AZ gov integrations via port-adapter `disabled | manual | api` until public APIs exist.
