"use client";

import { useEffect, useState } from "react";
import { CatalogField } from "@era/satellite-kit/ui";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
};

/** Occupied-room list. First field on clinic list filters. */
export function OccupiedRoomFilter({ label, value, onChange, allLabel }: Props) {
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sanatorium/episodes?includeHotelRooms=1&page=1&pageSize=1")
      .then((res) => res.json())
      .then((json: unknown) => {
        if (cancelled || !json || typeof json !== "object") return;
        const root = json as Record<string, unknown>;
        const nested =
          root.data && typeof root.data === "object" && !Array.isArray(root.data)
            ? (root.data as Record<string, unknown>)
            : root;
        const list = nested.hotelRooms;
        if (!Array.isArray(list)) return;
        setRooms(list.filter((row): row is string => typeof row === "string" && row.trim() !== ""));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CatalogField
      kind="SEARCHABLE"
      label={label}
      value={value}
      onChange={(next) => onChange(String(next ?? ""))}
      options={[{ value: "", label: allLabel }, ...rooms.map((room) => ({ value: room, label: room }))]}
      emptyLabel={allLabel}
    />
  );
}
