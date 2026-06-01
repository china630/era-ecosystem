"use client";

import { CARD_CONTAINER_CLASS } from "./design-system";

export function FaqSection({
  title,
  items,
  id,
}: {
  title: string;
  items: Array<{ id: string; question: string; answer: string }>;
  id?: string;
}) {
  return (
    <section id={id} className={`${CARD_CONTAINER_CLASS} p-6`}>
      <h1 className="mb-4 text-lg font-semibold text-[#34495E]">{title}</h1>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <h2 className="text-sm font-semibold text-[#34495E]">{item.question}</h2>
            <p className="mt-1 text-sm text-[#7F8C8D]">{item.answer}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
