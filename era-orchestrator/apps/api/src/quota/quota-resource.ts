/** Resources enforced by {@link CheckQuota} / {@link QuotaGuard}. */
export enum QuotaResource {
  USERS = "USERS",
  INVOICES_PER_MONTH = "INVOICES_PER_MONTH",
  /** Object storage (GB cap); enforced in services that write blobs, not only via guard. */
  STORAGE = "STORAGE",
  /** ERA POS stations (F&B outlet till / retail register) — capacity overage. */
  POS_STATIONS = "POS_STATIONS",
}
