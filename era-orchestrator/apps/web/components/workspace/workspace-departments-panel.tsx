"use client";

import { useCallback, useEffect, useState } from "react";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";

type DepartmentRow = {
  id: string;
  name: string;
  operatingMode: string;
};

type EndpointRow = {
  satelliteKey: string;
  baseUrl: string;
  enabled: boolean;
};

export function WorkspaceDepartmentsPanel() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const res = await orchFetch("/organizations/departments", { token });
    if (!res.ok) return;
    const data = (await res.json()) as {
      departments: DepartmentRow[];
      satelliteEndpoints: EndpointRow[];
    };
    setDepartments(data.departments ?? []);
    setEndpoints(data.satelliteEndpoints ?? []);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function copyId(id: string) {
    void navigator.clipboard.writeText(id);
    setMessage(`Copied ${id}`);
  }

  if (departments.length === 0 && endpoints.length === 0) return null;

  return (
    <div className={`${CARD_CONTAINER_CLASS} mb-6 p-4`}>
      <h2 className="text-sm font-semibold text-[#34495E]">Departments & env UUIDs</h2>
      <p className="mt-1 text-xs text-[#7F8C8D]">
        Child orgs for F&B, clinic, pharmacy. Copy UUIDs into docker `.env` (`ERA_*_ORGANIZATION_ID`).
      </p>
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {departments.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-1">
              <span className="font-medium">{d.name}</span>
              <code className="text-xs text-[#7F8C8D]">{d.id}</code>
              <button type="button" className="text-xs text-[#2980B9]" onClick={() => copyId(d.id)}>
                Copy UUID
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {endpoints.length > 0 ? (
        <div className="mt-3 text-xs text-[#7F8C8D]">
          <p className="font-medium text-[#34495E]">Satellite endpoints (read-only)</p>
          <ul className="mt-1 space-y-1">
            {endpoints.map((e) => (
              <li key={e.satelliteKey}>
                {e.satelliteKey}: {e.baseUrl} {e.enabled ? "" : "(disabled)"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
