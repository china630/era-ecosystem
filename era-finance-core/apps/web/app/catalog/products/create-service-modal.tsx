"use client";

import { ProductModal } from "./product-modal";

/** Service create: explicit SKU, VAT, price, and NAS revenue account; payload sets `isService: true`. */
export function CreateServiceModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <ProductModal open={open} productId={null} createAs="service" onClose={onClose} onSaved={onSaved} />
  );
}
