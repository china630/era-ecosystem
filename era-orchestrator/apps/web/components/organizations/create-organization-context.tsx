"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CreateOrganizationModal } from "./create-organization-modal";

type CreateOrganizationContextValue = {
  openCreateOrganization: () => void;
};

const CreateOrganizationContext =
  createContext<CreateOrganizationContextValue | null>(null);

export function CreateOrganizationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCreateOrganization = useCallback(() => setOpen(true), []);
  const value = useMemo(
    () => ({ openCreateOrganization }),
    [openCreateOrganization],
  );

  return (
    <CreateOrganizationContext.Provider value={value}>
      {children}
      <CreateOrganizationModal open={open} onClose={() => setOpen(false)} />
    </CreateOrganizationContext.Provider>
  );
}

export function useCreateOrganization(): CreateOrganizationContextValue {
  const ctx = useContext(CreateOrganizationContext);
  if (!ctx) {
    throw new Error("useCreateOrganization requires CreateOrganizationProvider");
  }
  return ctx;
}
