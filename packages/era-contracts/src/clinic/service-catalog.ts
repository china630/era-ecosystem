/** Clinic service catalog handoff from Finance → satellite ServiceCatalogCache. */
export type ClinicServiceCatalogItem = {
  code: string;
  description: string;
  amount: number;
  descriptionAz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  packageIncluded?: boolean;
  department?: string | null;
  kind?: string | null;
};

export type ClinicServiceCatalogResponse = {
  items: ClinicServiceCatalogItem[];
};
