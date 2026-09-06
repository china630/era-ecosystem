"use client";

import { useTranslations } from "next-intl";

/**
 * Coarse BODY_PART hotspots on front+back illustration.
 * Not physio S (~31) sites — contraindications stay on BODY_PART.
 *
 * Image: left = anterior, right = posterior.
 * Anatomical L/R: front → patient left is viewer right;
 * back → patient left is viewer left.
 */
type Hotspot = {
  id: string;
  key: string;
  top: string;
  left: string;
  width: string;
  height: string;
};

const PARTS: Hotspot[] = [
  // —— Front (centers ~25%) ——
  { id: "HEAD", key: "f-HEAD", top: "2%", left: "25%", width: "14%", height: "11%" },
  { id: "NECK", key: "f-NECK", top: "13%", left: "25%", width: "8%", height: "4%" },
  { id: "CHEST", key: "f-CHEST", top: "18%", left: "25%", width: "18%", height: "13%" },
  { id: "ABDOMEN", key: "f-ABDOMEN", top: "32%", left: "25%", width: "16%", height: "12%" },
  { id: "ARM_RIGHT", key: "f-ARM_RIGHT", top: "18%", left: "12%", width: "11%", height: "30%" },
  { id: "ARM_LEFT", key: "f-ARM_LEFT", top: "18%", left: "38%", width: "11%", height: "30%" },
  { id: "LEG_RIGHT", key: "f-LEG_RIGHT", top: "50%", left: "20%", width: "10%", height: "44%" },
  { id: "LEG_LEFT", key: "f-LEG_LEFT", top: "50%", left: "30%", width: "10%", height: "44%" },

  // —— Back (centers ~75%) ——
  { id: "HEAD", key: "b-HEAD", top: "2%", left: "75%", width: "14%", height: "11%" },
  { id: "NECK", key: "b-NECK", top: "13%", left: "75%", width: "8%", height: "4%" },
  { id: "BACK", key: "b-BACK", top: "18%", left: "75%", width: "18%", height: "24%" },
  { id: "ARM_LEFT", key: "b-ARM_LEFT", top: "18%", left: "62%", width: "11%", height: "30%" },
  { id: "ARM_RIGHT", key: "b-ARM_RIGHT", top: "18%", left: "88%", width: "11%", height: "30%" },
  { id: "LEG_LEFT", key: "b-LEG_LEFT", top: "50%", left: "70%", width: "10%", height: "44%" },
  { id: "LEG_RIGHT", key: "b-LEG_RIGHT", top: "50%", left: "80%", width: "10%", height: "44%" },
];

type Props = {
  blocked: Set<string>;
  onToggle: (bodyPart: string) => void;
};

export function BodySilhouette({ blocked, onToggle }: Props) {
  const t = useTranslations("contraindications");

  return (
    <div className="relative mx-auto h-[20rem] w-full max-w-[28rem] select-none sm:h-[22rem]">
      <img
        src="/images/body-silhouette.png"
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full object-contain object-center"
      />
      {PARTS.map((p) => {
        const active = blocked.has(p.id);
        const label = t(`parts.${p.id}`);
        return (
          <button
            key={p.key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onToggle(p.id)}
            className={`absolute -translate-x-1/2 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 ${
              active
                ? "bg-red-500/40 ring-2 ring-red-500 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.85)]"
                : "bg-transparent hover:bg-amber-400/30 hover:ring-1 hover:ring-amber-500/60"
            }`}
            style={{
              top: p.top,
              left: p.left,
              width: p.width,
              height: p.height,
            }}
          >
            {active ? (
              <span className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 rounded bg-red-700/90 px-1 py-px text-[9px] font-medium leading-none text-white">
                {label}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
