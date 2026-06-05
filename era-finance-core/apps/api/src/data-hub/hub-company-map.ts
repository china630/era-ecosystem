/** Map era-data-hub `/companies/:voen` payload to finance directory / MDM shapes. */
export function mapHubCompanyToDirectory(remote: Record<string, unknown>): {
  taxId: string;
  name: string;
  legalAddress: string | null;
  phone: string | null;
  directorName: string | null;
} {
  const taxId = String(remote.taxId ?? remote.voen ?? remote.tin ?? "").trim();
  const name = String(
    remote.name ?? remote.nameAz ?? remote.legalName ?? taxId,
  ).trim();
  return {
    taxId,
    name: name || taxId,
    legalAddress:
      (typeof remote.legalAddress === "string" && remote.legalAddress.trim()) ||
      (typeof remote.address === "string" && remote.address.trim()) ||
      null,
    phone:
      (typeof remote.phone === "string" && remote.phone.trim()) || null,
    directorName:
      (typeof remote.directorName === "string" && remote.directorName.trim()) ||
      null,
  };
}

export function mapHubCompanyToGlobalCounterparty(remote: Record<string, unknown>): {
  taxId: string;
  name: string;
  legalAddress: string | null;
  vatStatus: boolean;
} {
  const base = mapHubCompanyToDirectory(remote);
  const vatStatus =
    typeof remote.isVatPayer === "boolean"
      ? remote.isVatPayer
      : typeof remote.vatStatus === "boolean"
        ? remote.vatStatus
        : false;
  return {
    taxId: base.taxId,
    name: base.name,
    legalAddress: base.legalAddress,
    vatStatus,
  };
}
