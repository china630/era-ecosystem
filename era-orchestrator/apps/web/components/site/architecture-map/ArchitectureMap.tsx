"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@era/i18n-common";
import type {
  PublicSiteArchitectureEdge,
  PublicSiteSatellite,
  SiteCatalogMaturity,
  SiteCatalogResponse,
} from "../../../lib/site/site-catalog-types";
import type { SiteArchitectureEdgeKind } from "../../../lib/site/site-catalog-types";
import { siteLocalePath } from "../../../lib/site/locale-path";
import { siteProductIcon } from "../../../lib/site/site-product-icons";
import {
  ARCH_VIEW_H,
  ARCH_VIEW_W,
  ARCHITECTURE_MODULE_NODE_KEYS,
  ARCHITECTURE_NODE_LAYOUT,
  archLinkPath,
  industryBundleKeys,
  PLATFORM_ORCHESTRATOR_KEY,
  type ArchLayoutNode,
} from "./architecture-map-layout";
import {
  formatArchPrice,
  getArchitectureMapCopy,
} from "./architecture-map-i18n";

export type ArchitectureMapProps = {
  catalog: SiteCatalogResponse;
  locale: Locale;
  variant?: "home" | "industry" | "product";
  highlightKeys?: string[];
  foundationMonthlyAzn?: number;
  bankingMonthlyAzn?: number;
  pricingByKey?: Record<string, { fromPriceAzn: number; unit: "month" | "person" }>;
};

function edgeStroke(
  kind: SiteArchitectureEdgeKind,
  status: PublicSiteArchitectureEdge["realizationStatus"],
): { stroke: string; width: number; opacity: number; dash?: string } {
  if (status === "planned") {
    return { stroke: "#7F8C8D", width: 1.15, opacity: 0.38, dash: "2 5" };
  }
  if (status === "partial") {
    const stroke = kind === "REFERENCE_DATA" || kind === "ANALYTICS" ? "#7F8C8D" : "#2980B9";
    return { stroke, width: 1.25, opacity: 0.5, dash: "8 4" };
  }
  if (kind === "FOLIO_POST" || kind === "LIFECYCLE") {
    return { stroke: "#2980B9", width: 1.35, opacity: 0.65 };
  }
  if (kind === "STAFF_PROVISION") {
    return { stroke: "#7F8C8D", width: 1.2, opacity: 0.5 };
  }
  if (kind === "CRM_PARTY" || kind === "PLATFORM_IDENTITY") {
    return { stroke: "#a9c7db", width: 1.3, opacity: 1 };
  }
  if (kind === "SETTLEMENT" || kind === "BANK_CHANNEL") {
    return { stroke: "#a9c7db", width: 1.6, opacity: 1 };
  }
  return { stroke: "#a9c7db", width: 1.3, opacity: 1 };
}

function maturityLabel(
  m: SiteCatalogMaturity,
  copy: ReturnType<typeof getArchitectureMapCopy>,
): string {
  if (m === "pilot") return copy.maturityPilot;
  if (m === "in_development") return copy.maturityDev;
  return copy.maturityProd;
}

function resolveSatellite(
  catalog: SiteCatalogResponse,
  key: string,
): PublicSiteSatellite | undefined {
  return catalog.satellites.find((s) => s.satelliteKey === key);
}

function priceForKey(
  key: string,
  props: ArchitectureMapProps,
  copy: ReturnType<typeof getArchitectureMapCopy>,
): string | undefined {
  const { foundationMonthlyAzn, bankingMonthlyAzn, pricingByKey } = props;
  if (key === "finance_core" && foundationMonthlyAzn != null) {
    return formatArchPrice(copy.fromMonth, foundationMonthlyAzn);
  }
  if (key === "industry_banking" && bankingMonthlyAzn != null) {
    return formatArchPrice(copy.fromMonth, bankingMonthlyAzn);
  }
  const row = pricingByKey?.[key];
  if (!row) return undefined;
  return row.unit === "person"
    ? formatArchPrice(copy.fromPerson, row.fromPriceAzn)
    : formatArchPrice(copy.fromMonth, row.fromPriceAzn);
}

export function ArchitectureMap(props: ArchitectureMapProps) {
  const {
    catalog,
    locale,
    variant = "home",
    highlightKeys: highlightKeysProp = [],
    foundationMonthlyAzn,
    bankingMonthlyAzn,
    pricingByKey,
  } = props;

  const copy = useMemo(() => getArchitectureMapCopy(locale), [locale]);
  const router = useRouter();
  const pulseId = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const activeKey = focusKey ?? hoverKey;

  const filterKeys = useMemo(() => {
    if (!industryFilter) return null;
    const ind = catalog.industries.find((i) => i.slug === industryFilter);
    if (!ind) return null;
    return new Set(industryBundleKeys(ind.slug, ind.items));
  }, [catalog.industries, industryFilter]);

  const highlightSet = useMemo(() => {
    const base = new Set(highlightKeysProp);
    if (filterKeys) {
      for (const k of filterKeys) base.add(k);
    }
    return base.size > 0 ? base : null;
  }, [highlightKeysProp, filterKeys]);

  const satellitesByKey = useMemo(() => {
    const map = new Map<string, PublicSiteSatellite>();
    for (const s of catalog.satellites) map.set(s.satelliteKey, s);
    return map;
  }, [catalog.satellites]);

  const drawableEdges = useMemo(() => {
    return (catalog.edges ?? [])
      .filter(
        (e) =>
          e.fromKey !== PLATFORM_ORCHESTRATOR_KEY &&
          !e.fromKey.startsWith("__") &&
          !e.toKey.startsWith("__") &&
          ARCHITECTURE_NODE_LAYOUT[e.fromKey] &&
          ARCHITECTURE_NODE_LAYOUT[e.toKey],
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [catalog.edges]);

  const incidentEdgeIds = useMemo(() => {
    if (!activeKey) return new Set<string>();
    return new Set(
      drawableEdges
        .filter((e) => e.fromKey === activeKey || e.toKey === activeKey)
        .map((e, idx) => `edge-${e.fromKey}-${e.toKey}-${idx}`),
    );
  }, [activeKey, drawableEdges]);

  const pulseEdgeIds = useMemo(() => {
    if (!mounted || reduceMotion) return [] as string[];
    const picks: string[] = [];
    drawableEdges.forEach((e, idx) => {
      if (e.realizationStatus !== "live") return;
      const id = `edge-${e.fromKey}-${e.toKey}-${idx}`;
      if (picks.length < 2 && (e.toKey === "finance_core" || e.fromKey === "finance_core")) {
        picks.push(id);
      }
    });
    if (picks.length < 1) {
      const firstLive = drawableEdges.findIndex((e) => e.realizationStatus === "live");
      if (firstLive >= 0) {
        const e = drawableEdges[firstLive]!;
        picks.push(`edge-${e.fromKey}-${e.toKey}-${firstLive}`);
      }
    }
    return picks.slice(0, 2);
  }, [drawableEdges, mounted, reduceMotion]);

  const cardSatellite = activeKey ? resolveSatellite(catalog, activeKey) : null;
  const cardLayout = activeKey ? ARCHITECTURE_NODE_LAYOUT[activeKey] : null;

  const navigateToSatellite = useCallback(
    (key: string) => {
      const resolvedKey = key === "banking_dbo" ? "industry_banking" : key;
      const sat = resolveSatellite(catalog, resolvedKey);
      if (!sat?.publicSlug) return;
      router.push(siteLocalePath(locale, `/satellites/${sat.publicSlug}`));
    },
    [catalog, locale, router],
  );

  const dimEdges = Boolean(activeKey) || Boolean(highlightSet);
  const compact = variant === "product";
  const showChips = variant === "home" && catalog.industries.length > 0;
  const showLegend = variant !== "product";

  const nodeOpacity = (key: string) => {
    if (activeKey) {
      if (key === activeKey) return 1;
      const onEdge = drawableEdges.some(
        (e) =>
          (e.fromKey === activeKey && e.toKey === key) ||
          (e.toKey === activeKey && e.fromKey === key),
      );
      return onEdge ? 0.85 : 0.28;
    }
    if (highlightSet && !highlightSet.has(key)) return 0.22;
    return 1;
  };

  const edgeOpacity = (edgeId: string, from: string, to: string) => {
    if (activeKey) {
      if (edgeId && incidentEdgeIds.has(edgeId)) return 1;
      if (from === activeKey || to === activeKey) return 1;
      return 0.14;
    }
    if (highlightSet) {
      if (highlightSet.has(from) && highlightSet.has(to)) return 1;
      return 0.1;
    }
    return 1;
  };

  const coreNodes = ["finance_core", "industry_banking"] as const;
  const moduleNodeSet = new Set<string>(ARCHITECTURE_MODULE_NODE_KEYS);

  return (
    <section
      className={compact ? "w-full" : "w-full px-4 py-6 md:py-8"}
      aria-label={copy.mapTitle}
    >
      {variant === "home" ? (
        <p className="mx-auto mb-3 max-w-3xl text-center text-sm text-[#7F8C8D] lg:text-left">
          {copy.mapDesc}
        </p>
      ) : null}

      {showChips ? (
        <div
          className="mb-3 flex flex-wrap justify-center gap-2 lg:justify-start"
          role="toolbar"
          aria-label={copy.mapTitle}
        >
          <FilterChip
            active={!industryFilter}
            onClick={() => setIndustryFilter(null)}
          >
            {copy.filterAll}
          </FilterChip>
          {catalog.industries.map((ind) => (
            <FilterChip
              key={ind.slug}
              active={industryFilter === ind.slug}
              onClick={() =>
                setIndustryFilter((prev) => (prev === ind.slug ? null : ind.slug))
              }
            >
              {ind.name}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {/* Mobile simplified list */}
      <div className="lg:hidden">
        <ArchitectureMapMobileList
          catalog={catalog}
          locale={locale}
          copy={copy}
          props={props}
        />
      </div>

      {/* Desktop SVG */}
      <div
        className={`relative hidden overflow-hidden rounded-2xl border border-[#D5DADF] bg-gradient-to-b from-[#f8fafb] to-white lg:block ${
          compact ? "max-h-[320px]" : ""
        }`}
      >
        <svg
          viewBox={`0 0 ${ARCH_VIEW_W} ${ARCH_VIEW_H}`}
          className="block h-auto w-full"
          role="img"
          aria-labelledby={`${pulseId}-title`}
        >
          <title id={`${pulseId}-title`}>{copy.mapTitle}</title>
          <desc>{copy.mapDesc}</desc>

          <ellipse
            cx={600}
            cy={305}
            rx={560}
            ry={compact ? 250 : 285}
            fill="#EBF5FB"
            fillOpacity={0.55}
            stroke="#D5DADF"
            strokeWidth={1}
          />
          <text
            x={600}
            y={625}
            textAnchor="middle"
            className="fill-[#7F8C8D] text-[10px] font-semibold uppercase tracking-wide"
          >
            {copy.platformBand}
          </text>

          <ellipse
            cx={600}
            cy={305}
            rx={560}
            ry={compact ? 250 : 285}
            fill="none"
            stroke="#2980B9"
            strokeOpacity={0.28}
            strokeWidth={1.15}
          />
          <ellipse
            cx={600}
            cy={305}
            rx={512}
            ry={compact ? 228 : 260}
            fill="none"
            stroke="#7F8C8D"
            strokeOpacity={0.32}
            strokeWidth={1.15}
          />

          {!compact ? (
            <>
              <ellipse cx={508} cy={198} rx={200} ry={88} fill="#2980B9" fillOpacity={0.04} />
              <ellipse cx={252} cy={405} rx={108} ry={125} fill="#2980B9" fillOpacity={0.04} />
              <ellipse cx={528} cy={538} rx={195} ry={76} fill="#2980B9" fillOpacity={0.04} />
              <circle cx={800} cy={315} r={170} fill="#2980B9" fillOpacity={0.06} />
            </>
          ) : null}

          <g fill="none">
            {drawableEdges.map((edge, idx) => {
              const path = archLinkPath(edge.fromKey, edge.toKey);
              if (!path) return null;
              const edgeId = `edge-${edge.fromKey}-${edge.toKey}-${idx}`;
              const style = edgeStroke(edge.kind, edge.realizationStatus);
              const op = edgeOpacity(edgeId, edge.fromKey, edge.toKey);
              return (
                <path
                  key={edgeId}
                  id={edgeId}
                  d={path}
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeOpacity={style.opacity * op}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: dimEdges ? op : 1 }}
                />
              );
            })}
          </g>

          {mounted && !reduceMotion
            ? pulseEdgeIds.map((href, i) => (
                <use
                  key={`pulse-${href}-${i}`}
                  href={`#${href}`}
                  className="arch-map-pulse"
                  style={{
                    fill: "none",
                    stroke: "#2980B9",
                    strokeWidth: 2,
                    strokeLinecap: "round",
                    strokeDasharray: "10 260",
                    opacity: 0.85,
                    pointerEvents: "none",
                    animationDelay: i === 1 ? "-2.5s" : undefined,
                  }}
                />
              ))
            : null}

          {Object.values(ARCHITECTURE_NODE_LAYOUT).map((layout) => {
            const sat = satellitesByKey.get(layout.key);
            const isCore = coreNodes.includes(
              layout.key as (typeof coreNodes)[number],
            );
            const isModule = moduleNodeSet.has(layout.key);
            if (!sat && !isCore && !isModule) {
              return null;
            }
            return (
              <ArchNode
                key={layout.key}
                layout={layout}
                satellite={sat}
                fallbackName={
                  isModule ? copy.moduleNodeNames[layout.key] : undefined
                }
                fallbackTag={
                  isModule ? copy.moduleNodeTags[layout.key] : undefined
                }
                copy={copy}
                opacity={nodeOpacity(layout.key)}
                active={activeKey === layout.key}
                price={priceForKey(layout.key, props, copy)}
                onHover={setHoverKey}
                onFocus={setFocusKey}
                onActivate={() => navigateToSatellite(layout.key)}
                isCore={layout.shape === "core"}
              />
            );
          })}
        </svg>

        {cardSatellite && cardLayout ? (
          <aside
            className="pointer-events-none absolute bottom-4 right-4 w-[min(100%,260px)] rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-lg"
            aria-live="polite"
          >
            <p className="m-0 text-[15px] font-semibold tracking-tight text-[#34495E]">
              {cardSatellite.name}
            </p>
            {priceForKey(cardSatellite.satelliteKey, props, copy) ? (
              <p className="mt-0.5 mb-1 text-xs text-[#7F8C8D]">
                {priceForKey(cardSatellite.satelliteKey, props, copy)}
              </p>
            ) : null}
            <p className="m-0 mb-2 text-[13px] leading-snug text-[#7F8C8D]">
              {cardSatellite.tagline || cardSatellite.description}
            </p>
            <span className="inline-flex rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] px-2 py-0.5 text-[10px] font-medium text-[#2471A3]">
              {maturityLabel(cardSatellite.maturity, copy)}
            </span>
            {cardSatellite.publicSlug ? (
              <Link
                href={siteLocalePath(locale, `/satellites/${cardSatellite.publicSlug}`)}
                className="pointer-events-auto mt-3 inline-block text-sm font-semibold text-[#2980B9] no-underline hover:text-[#2471A3]"
              >
                {copy.viewProduct}
              </Link>
            ) : null}
          </aside>
        ) : null}
      </div>

      {showLegend ? (
        <div className="mt-3 hidden flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#7F8C8D] lg:flex">
          <LegendSwatch borderColor="#a9c7db" label={copy.legendLive} />
          <LegendSwatch borderColor="#2980B9" dashed label={copy.legendPartial} />
          <LegendSwatch borderColor="#7F8C8D" dotted label={copy.legendPlanned} />
          <LegendSwatch borderColor="#2980B9" label={copy.legendFolio} opacity={0.7} />
        </div>
      ) : null}

      <style jsx>{`
        @keyframes arch-pulse-travel {
          to {
            stroke-dashoffset: -270;
          }
        }
        :global(.arch-map-pulse) {
          animation: arch-pulse-travel 5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.arch-map-pulse) {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2980B9] ${
        active
          ? "border-[#2980B9] bg-[#EBF5FB] text-[#2471A3]"
          : "border-[#D5DADF] bg-white text-[#34495E] hover:border-[#2980B9]"
      }`}
    >
      {children}
    </button>
  );
}

function LegendSwatch({
  borderColor,
  label,
  dashed,
  dotted,
  opacity = 1,
}: {
  borderColor: string;
  label: string;
  dashed?: boolean;
  dotted?: boolean;
  opacity?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-[26px] border-t-2"
        style={{
          borderColor,
          borderTopStyle: dotted ? "dotted" : dashed ? "dashed" : "solid",
          opacity,
        }}
      />
      {label}
    </span>
  );
}

function ArchNode({
  layout,
  satellite,
  fallbackName,
  fallbackTag,
  copy,
  opacity,
  active,
  price,
  onHover,
  onFocus,
  onActivate,
  isCore,
}: {
  layout: ArchLayoutNode;
  satellite?: PublicSiteSatellite;
  fallbackName?: string;
  fallbackTag?: string;
  copy: ReturnType<typeof getArchitectureMapCopy>;
  opacity: number;
  active: boolean;
  price?: string;
  onHover: (key: string | null) => void;
  onFocus: (key: string | null) => void;
  onActivate: () => void;
  isCore: boolean;
}) {
  const Icon = siteProductIcon(satellite?.publicSlug ?? layout.key);
  const name = satellite?.name ?? fallbackName ?? layout.key;
  const meta = price ?? fallbackTag;
  const labelY =
    layout.labelSide === "top"
      ? -38
      : layout.labelSide === "bottom"
        ? 44
        : layout.labelSide === "left"
          ? 4
          : 4;

  if (layout.shape === "pill") {
    const w = layout.pillW ?? 160;
    const h = layout.pillH ?? 46;
    return (
      <g
        opacity={opacity}
        transform={`translate(${layout.x}, ${layout.y})`}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={name}
        onMouseEnter={() => onHover(layout.key)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onFocus(layout.key)}
        onBlur={() => onFocus(null)}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
      >
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={h / 2}
          fill="#fff"
          stroke={active ? "#2471A3" : layout.key === "platform_workforce" ? "#7F8C8D" : "#2980B9"}
          strokeWidth={1.2}
          strokeOpacity={0.45}
        />
        <text x={w / 2} y={20} textAnchor="middle" className="fill-[#34495E] text-[11.5px] font-semibold">
          {name}
        </text>
        {price ? (
          <text x={w / 2} y={34} textAnchor="middle" className="fill-[#7F8C8D] text-[9.5px]">
            {price}
          </text>
        ) : satellite?.tagline ? (
          <text x={w / 2} y={34} textAnchor="middle" className="fill-[#7F8C8D] text-[9.5px]">
            {satellite.tagline.slice(0, 42)}
          </text>
        ) : null}
      </g>
    );
  }

  const r = layout.r ?? (isCore ? 60 : 26);

  return (
    <g
      opacity={opacity}
      transform={`translate(${layout.x}, ${layout.y})`}
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`${name}${meta ? `, ${meta}` : ""}`}
      onMouseEnter={() => onHover(layout.key)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onFocus(layout.key)}
      onBlur={() => onFocus(null)}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {isCore ? (
        <circle
          r={r}
          fill="#EBF5FB"
          stroke="#2980B9"
          strokeWidth={1.6}
          className={active ? "stroke-[#2471A3]" : undefined}
        />
      ) : (
        <circle
          r={r}
          fill="#fff"
          stroke={active ? "#2471A3" : "#D5DADF"}
          strokeWidth={1.25}
        />
      )}
      {!isCore ? <circle r={11} fill="#EBF5FB" /> : <circle r={8} fill="#2980B9" />}
      <foreignObject x={-12} y={-12} width={24} height={24}>
        <div
          className={`flex h-6 w-6 items-center justify-center ${isCore ? "text-[#2980B9]" : "text-[#2471A3]"}`}
        >
          <Icon width={14} height={14} strokeWidth={2} aria-hidden />
        </div>
      </foreignObject>
      <text
        x={layout.labelSide === "left" ? -32 : layout.labelSide === "right" ? 32 : 0}
        y={labelY}
        textAnchor={
          layout.labelSide === "left" ? "end" : layout.labelSide === "right" ? "start" : "middle"
        }
        className="fill-[#34495E] text-[11.5px] font-semibold"
      >
        {name}
      </text>
      {meta ? (
        <text
          x={layout.labelSide === "left" ? -32 : layout.labelSide === "right" ? 32 : 0}
          y={labelY + 12}
          textAnchor={
            layout.labelSide === "left" ? "end" : layout.labelSide === "right" ? "start" : "middle"
          }
          className="fill-[#7F8C8D] text-[9.5px]"
        >
          {meta}
        </text>
      ) : null}
      {satellite?.maturity === "pilot" || layout.key === "banking_dbo" ? (
        <g transform={`translate(${isCore ? 28 : 16}, ${isCore ? -46 : -30})`}>
          <rect width={36} height={14} rx={4} fill="#EBF5FB" stroke="rgba(41,128,185,.35)" />
          <text x={18} y={10.5} textAnchor="middle" className="fill-[#2471A3] text-[8px] font-bold">
            {copy.maturityPilot}
          </text>
        </g>
      ) : null}
      {isCore ? (
        <>
          <text y={28} textAnchor="middle" className="fill-[#34495E] text-[13px] font-bold">
            {name}
          </text>
          {price ? (
            <text y={43} textAnchor="middle" className="fill-[#7F8C8D] text-[10px]">
              {price}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function ArchitectureMapMobileList({
  catalog,
  locale,
  copy,
  props,
}: {
  catalog: SiteCatalogResponse;
  locale: Locale;
  copy: ReturnType<typeof getArchitectureMapCopy>;
  props: ArchitectureMapProps;
}) {
  const cores = catalog.satellites.filter(
    (s) => s.satelliteKey === "finance_core" || s.satelliteKey === "industry_banking",
  );
  const rest = catalog.satellites
    .filter((s) => s.satelliteKey !== "finance_core" && s.satelliteKey !== "industry_banking")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4 rounded-2xl border border-[#D5DADF] bg-white p-4">
      <div>
        <h3 className="m-0 text-sm font-semibold text-[#34495E]">{copy.mobileCores}</h3>
        <ul className="mt-2 list-none space-y-2 p-0">
          {cores.map((s) => (
            <MobileRow key={s.satelliteKey} sat={s} locale={locale} copy={copy} props={props} />
          ))}
        </ul>
        <h3 className="mb-0 mt-4 text-sm font-semibold text-[#34495E]">{copy.mobileProducts}</h3>
        <ul className="mt-2 list-none space-y-2 p-0">
          {rest.map((s) => (
            <MobileRow key={s.satelliteKey} sat={s} locale={locale} copy={copy} props={props} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function MobileRow({
  sat,
  locale,
  copy,
  props,
}: {
  sat: PublicSiteSatellite;
  locale: Locale;
  copy: ReturnType<typeof getArchitectureMapCopy>;
  props: ArchitectureMapProps;
}) {
  const Icon = siteProductIcon(sat.publicSlug);
  const price = priceForKey(sat.satelliteKey, props, copy);
  return (
    <li>
      <Link
        href={siteLocalePath(locale, `/satellites/${sat.publicSlug}`)}
        className="flex items-start gap-3 rounded-xl border border-[#EBEDF0] bg-[#f8fafb] p-3 no-underline"
      >
        <span className="mt-0.5 inline-flex rounded-lg bg-[#EBF5FB] p-2 text-[#2980B9]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-medium text-[#34495E]">{sat.name}</p>
          {price ? <p className="m-0 mt-0.5 text-xs text-[#2980B9]">{price}</p> : null}
          <p className="m-0 mt-1 line-clamp-2 text-xs text-[#7F8C8D]">{sat.tagline || sat.description}</p>
        </div>
      </Link>
    </li>
  );
}