"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Requisition = {
  id: string;
  itemCode: string;
  description: string;
  qty: string | number;
  status: string;
  project: { code: string; name: string };
};

export default function MaterialRequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [projectCode, setProjectCode] = useState("PRJ-001");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/material-requisitions");
    const data = await res.json();
    setRequisitions(Array.isArray(data) ? data : data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createRequisition(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/material-requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectCode,
        itemCode,
        description,
        qty: Number(qty),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Create failed");
      return;
    }
    setMessage(`Requisition created for ${data.project?.code ?? projectCode}`);
    setItemCode("");
    setDescription("");
    setQty("");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Material requisitions"
        subtitle="C2 — create requisition from project"
        actions={
          <Link href="/projects" className={PRIMARY_BUTTON_CLASS}>
            Projects
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        <form onSubmit={createRequisition} className="space-y-3 rounded border p-4">
          <h2 className="text-[13px] font-semibold">New requisition</h2>
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Project code"
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
          />
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Item code"
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
          />
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="block w-full rounded border px-2 py-1 text-[13px]"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            Create
          </button>
        </form>
        {message && <p className="text-[13px]">{message}</p>}
        <ul className="space-y-2 text-[13px]">
          {requisitions.map((r) => (
            <li key={r.id} className="rounded border p-2">
              {r.project.code}: {r.itemCode} — {r.description} ({Number(r.qty)})
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
