"use client";

const PARTS = [
  { id: "HEAD", label: "Head", y: 8 },
  { id: "NECK", label: "Neck", y: 22 },
  { id: "CHEST", label: "Chest", y: 32 },
  { id: "BACK", label: "Back", y: 42 },
  { id: "ABDOMEN", label: "Abdomen", y: 52 },
  { id: "ARM_LEFT", label: "L.arm", y: 38, x: 12 },
  { id: "ARM_RIGHT", label: "R.arm", y: 38, x: 88 },
  { id: "LEG_LEFT", label: "L.leg", y: 72, x: 35 },
  { id: "LEG_RIGHT", label: "R.leg", y: 72, x: 65 },
] as const;

type Props = {
  blocked: Set<string>;
  onToggle: (bodyPart: string) => void;
};

export function BodySilhouette({ blocked, onToggle }: Props) {
  return (
    <div className="relative mx-auto h-64 w-40 rounded-lg border border-slate-300 bg-slate-50">
      <div className="absolute left-1/2 top-4 h-10 w-10 -translate-x-1/2 rounded-full bg-slate-200" />
      <div className="absolute left-1/2 top-14 h-28 w-16 -translate-x-1/2 rounded-xl bg-slate-200" />
      <div className="absolute bottom-6 left-6 h-20 w-5 rounded-full bg-slate-200" />
      <div className="absolute bottom-6 right-6 h-20 w-5 rounded-full bg-slate-200" />
      {PARTS.map((p) => {
        const active = blocked.has(p.id);
        const left = "x" in p ? `${p.x}%` : "50%";
        return (
          <button
            key={p.id}
            type="button"
            title={p.label}
            onClick={() => onToggle(p.id)}
            className={`absolute -translate-x-1/2 rounded px-1 py-0.5 text-[10px] ${
              active
                ? "bg-red-600 text-white"
                : "bg-white/90 text-slate-700 ring-1 ring-slate-300"
            }`}
            style={{ top: `${p.y}%`, left }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
