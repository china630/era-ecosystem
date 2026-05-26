"use client";

import { useCallback, useEffect, useState } from "react";
import { PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { SuperAdminDataTable } from "../../../../components/super-admin-data-table";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";

export default function MdmCompaniesPage() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await cpAdminFetch(`mdm/companies?page=${page}&pageSize=25`);
    if (res.ok) {
      const data = (await res.json()) as {
        total: number;
        items: Array<{ id: string; name: string; taxId: string; organizationId: string | null; updatedAt: string }>;
      };
      setTotal(data.total);
      setItems(
        data.items.map((i) => ({
          id: i.id,
          name: i.name,
          taxId: i.taxId,
          organizationId: i.organizationId ?? "",
          updatedAt: i.updatedAt,
        })),
      );
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">MDM — companies</h1>
      <SuperAdminDataTable
        loading={loading}
        columns={["name", "taxId", "organizationId", "updatedAt"]}
        rows={items}
      />
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span>
          Page {page} / {Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={page * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
