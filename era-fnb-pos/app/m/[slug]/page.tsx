"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Item = { id: string; name: string; priceAzn: string | number };
type Cat = { id: string; name: string; items: Item[] };

export default function PublicQrMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [name, setName] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/public/menu/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Not found");
        setName(d.outlet?.name ?? "");
        setCats(Array.isArray(d.categories) ? d.categories : []);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) return <main className="p-6 text-sm text-red-600">{error}</main>;

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-2xl font-semibold">{name || "Menu"}</h1>
      <p className="mb-4 text-sm text-[#7F8C8D]">Prices only — order at the counter</p>
      {cats.map((c) => (
        <section key={c.id} className="mb-4">
          <h2 className="mb-2 font-semibold">{c.name}</h2>
          <ul className="grid gap-1">
            {c.items.map((i) => (
              <li key={i.id} className="flex justify-between text-sm">
                <span>{i.name}</span>
                <span>{Number(i.priceAzn).toFixed(2)} AZN</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
