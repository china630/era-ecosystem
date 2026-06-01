"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CARD_CLASS } from "@/lib/design-system";

type MenuItem = {
  id: string;
  plu: string;
  name: string;
  priceAzn: string | number;
  active: boolean;
};

type Category = {
  id: string;
  name: string;
  items: MenuItem[];
};

export default function MenuAdminPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [plu, setPlu] = useState("");
  const [name, setName] = useState("");
  const [priceAzn, setPriceAzn] = useState("");
  const [categoryName, setCategoryName] = useState("Mains");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/menu");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryName,
        plu,
        name,
        priceAzn: Number(priceAzn),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Create failed (manager login required)");
      return;
    }
    setMessage(`Created ${data.name}`);
    setPlu("");
    setName("");
    setPriceAzn("");
    await load();
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#7F8C8D]">FB-0 menu admin (manager role)</p>
        <Link href="/login" className="text-sm text-[#2980B9] underline">
          Login
        </Link>
      </div>
      <form onSubmit={createItem} className={`${CARD_CLASS} mb-6 space-y-3 p-4`}>
        <h2 className="text-sm font-semibold">Add menu item</h2>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Category"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="PLU"
          value={plu}
          onChange={(e) => setPlu(e.target.value)}
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Price AZN"
          value={priceAzn}
          onChange={(e) => setPriceAzn(e.target.value)}
        />
        <button type="submit" className="rounded bg-[#2980B9] px-3 py-1.5 text-sm text-white">
          Save item
        </button>
      </form>
      {message && <p className="mb-3 text-sm">{message}</p>}
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className={`${CARD_CLASS} p-4`}>
            <h3 className="font-semibold">{cat.name}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {cat.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.plu} — {item.name}
                  </span>
                  <span>{Number(item.priceAzn).toFixed(2)} AZN</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
