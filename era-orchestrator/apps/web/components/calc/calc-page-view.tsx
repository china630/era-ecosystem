"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@era/i18n-common";
import { PRIMARY_BUTTON_CLASS, PublicLegalFooter, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { getCalcCopy, type CalcCopy } from "../../lib/i18n/calc-copy";
import { getLandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { getPricingStorefrontUiCopy, type PricingStorefrontUiCopy } from "../../lib/i18n/pricing-storefront-copy";
import { LandingLanguageToggle } from "../landing/landing-language-toggle";
import { LandingPageShell } from "../landing/landing-page-shell";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import {
  emptyCalcState,
  quoteMonthly,
  type CalcState,
  type QuoteCatalog,
  type QuoteLine,
  type QuoteResult,
} from "../../lib/pricing/quote-calculator";
import {
  applyPreset,
  bundleSatelliteKey,
  catalogFromSnapshot,
  parseCalcState,
  serializeCalcState,
  setWorkforcePackage,
  toggleBundle,
  toggleModule,
  type PresetId,
} from "../../lib/pricing/quote-selection";

const DATA_HUB = ["platform_reference_data", "platform_datahub_silver", "platform_datahub_gold"];
const DOMAIN = ["platform_domain", "platform_domain_org"];
const PRESETS: PresetId[] = ["core", "hotel_city", "hotel_resort", "sanatorium", "clinic", "kafe", "retail"];

const FAQ_LABELS = {
  az: { navAria: "Hüquqi keçidlər", faq: "FAQ", terms: "Şərtlər", privacy: "Məxfilik", status: "Status" },
  ru: { navAria: "Юридические ссылки", faq: "FAQ", terms: "Условия", privacy: "Конфиденциальность", status: "Статус" },
  en: { navAria: "Legal links", faq: "FAQ", terms: "Terms", privacy: "Privacy", status: "Status" },
} as const;

function fmtAzn(n: number): string {
  const digits = Math.abs(n - Math.round(n)) < 0.001 ? 0 : 2;
  return `${n.toFixed(digits)} AZN`;
}

function workforceRank(keys: readonly string[]): 0 | 1 | 2 | 3 {
  if (keys.includes("platform_workforce_premium")) return 3;
  if (keys.includes("platform_workforce_pro")) return 2;
  if (keys.includes("platform_workforce_base") || keys.includes("platform_workforce")) return 1;
  return 0;
}

function skuName(key: string, fallback: string, ui: PricingStorefrontUiCopy): string {
  return (
    ui.hospitalityModuleNames[key] ||
    ui.industryModuleNames[key] ||
    ui.platformAddonNames[key] ||
    fallback
  );
}

export function CalcPageView({
  initialLocale,
  snapshot,
}: {
  initialLocale: Locale;
  snapshot: PublicPricingResponse;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState<CalcState>(emptyCalcState);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = useMemo(() => getCalcCopy(locale), [locale]);
  const uiLocale = locale === "ru" ? "ru" : "az";
  const ui = useMemo(() => getPricingStorefrontUiCopy(uiLocale), [uiLocale]);
  const catalog = useMemo(() => catalogFromSnapshot(snapshot), [snapshot]);
  const blocked = snapshot.unavailable === true || (snapshot.pricingModules ?? []).length === 0;
  const quote = useMemo(() => (blocked ? null : quoteMonthly(catalog, state)), [blocked, catalog, state]);
  const landing = getLandingMarketingCopy(locale === "ru" ? "ru" : "az");
  const loginLabel = locale === "en" ? "Sign in" : landing.chrome.login;
  const satellitesLabel = locale === "en" ? "Satellites" : landing.chrome.navSatellites;
  const pricingLabel = locale === "en" ? "Pricing" : landing.hero.navPricing;
  const registerLabel = locale === "en" ? "Start free" : landing.hero.ctaPrimary;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      const parsed = parseCalcState(q);
      if (parsed) setState(parsed);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = `/calc?q=${encodeURIComponent(serializeCalcState(state))}`;
    window.history.replaceState(null, "", next);
  }, [ready, state]);

  const covered = useMemo(() => {
    const set = new Set<string>();
    for (const id of state.bundleIds) {
      const bundle = catalog.bundles.find((b) => b.marketingId === id);
      bundle?.moduleKeys.forEach((k) => set.add(k));
    }
    return set;
  }, [catalog.bundles, state.bundleIds]);

  const active = new Set(quote?.activeKeys ?? state.moduleKeys);
  const patch = (next: CalcState) => setState(next);

  async function share() {
    const url = `${window.location.origin}/calc?q=${encodeURIComponent(serializeCalcState(state))}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <LandingPageShell>
      <style>{`@media print { header, #calc-form, #calc-mobile-bar, footer { display: none !important; } #calc-quote { position: static !important; } }`}</style>
      <header className="sticky top-0 z-20 border-b border-[#D5DADF]/80 bg-white/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-[#34495E] no-underline">
            ERA 365
          </Link>
          <nav className="flex flex-wrap items-center gap-2 md:gap-3">
            <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
            <Link href="/satellites" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
              {satellitesLabel}
            </Link>
            <Link href="/pricing" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
              {pricingLabel}
            </Link>
            <Link href="/calc" className={`${SECONDARY_BUTTON_CLASS} text-xs text-[#2980B9] no-underline`} aria-current="page">
              {copy.nav}
            </Link>
            <Link href="/login" className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
              {loginLabel}
            </Link>
            <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}>
              {registerLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 md:py-12 lg:pb-12">
        <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-[#2980B9]">ERA 365</p>
        <h1 className="mt-2 m-0 text-3xl font-bold tracking-tight text-[#34495E] md:text-4xl">{copy.title}</h1>
        <p className="mt-3 m-0 max-w-3xl text-[16px] leading-relaxed text-[#7F8C8D]">{copy.subtitle}</p>

        {blocked ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{copy.unavailable}</p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{copy.presets}</span>
              {PRESETS.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`preset-${id}`}
                  className="rounded-full border border-[#D5DADF] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#34495E] hover:border-[#2980B9]"
                  onClick={() => patch(applyPreset(id, catalog))}
                >
                  {copy.preset[id]}
                </button>
              ))}
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#7F8C8D] underline"
                onClick={() => patch(emptyCalcState())}
              >
                {copy.reset}
              </button>
            </div>

            <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div id="calc-form" className="space-y-4">
                <CoreSection
                  copy={copy}
                  ui={ui}
                  catalog={catalog}
                  snapshot={snapshot}
                  state={state}
                  covered={covered}
                  onChange={patch}
                />
                <SatellitesSection
                  copy={copy}
                  ui={ui}
                  catalog={catalog}
                  snapshot={snapshot}
                  state={state}
                  active={active}
                  covered={covered}
                  onChange={patch}
                />
                <AddonsSection copy={copy} ui={ui} catalog={catalog} snapshot={snapshot} state={state} onChange={patch} />
                <UsageSection copy={copy} state={state} onChange={patch} />
              </div>
              <QuoteCard
                copy={copy}
                ui={ui}
                catalog={catalog}
                quote={quote}
                yearly={state.yearly}
                copied={copied}
                onYearly={(yearly) => patch({ ...state, yearly })}
                onShare={() => void share()}
              />
            </div>
          </>
        )}
      </main>

      {quote ? (
        <div
          id="calc-mobile-bar"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[#D5DADF] bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
        >
          <a href="#calc-quote" className="flex items-center justify-between no-underline">
            <span className="text-[12px] font-semibold text-[#7F8C8D]">{copy.monthlyTotal}</span>
            <span className="text-lg font-bold tabular-nums text-[#2980B9]" data-testid="calc-monthly-total-mobile">
              {fmtAzn(quote.monthlyTotalAzn)}
            </span>
          </a>
        </div>
      ) : null}

      <footer className="border-t border-[#D5DADF]/80 px-4 py-8">
        <PublicLegalFooter locale={locale} faqHref="/#faq" appPrefix="ERA365" labels={FAQ_LABELS[locale] ?? FAQ_LABELS.az} />
      </footer>
    </LandingPageShell>
  );
}

function CoreSection({
  copy,
  ui,
  catalog,
  snapshot,
  state,
  covered,
  onChange,
}: {
  copy: CalcCopy;
  ui: PricingStorefrontUiCopy;
  catalog: QuoteCatalog;
  snapshot: PublicPricingResponse;
  state: CalcState;
  covered: Set<string>;
  onChange: (next: CalcState) => void;
}) {
  const coreBundles = catalog.bundles.filter((b) => bundleSatelliteKey(b.moduleKeys) == null);
  const standards = (snapshot.standardModules ?? []).filter((m) => m.moduleKeys.length > 0);
  return (
    <Section id="calc-core" title={copy.coreTitle} intro={copy.coreIntro}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Choice
          pressed={state.foundation}
          title={copy.foundation}
          price={fmtAzn(snapshot.foundationMonthlyAzn)}
          note={copy.foundationHint}
          onClick={() => onChange({ ...state, foundation: !state.foundation })}
        />
        <Choice
          pressed={state.kafeWaiver}
          title={copy.kafeWaiver}
          note={copy.kafeWaiverHint}
          onClick={() => onChange({ ...state, kafeWaiver: !state.kafeWaiver, foundation: state.kafeWaiver ? state.foundation : true })}
        />
      </div>
      {coreBundles.length > 0 ? (
        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold text-[#34495E]">{copy.bundles}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Choice
              pressed={coreBundles.every((b) => !state.bundleIds.includes(b.marketingId))}
              title={copy.bundleNone}
              onClick={() =>
                onChange({
                  ...state,
                  bundleIds: state.bundleIds.filter((id) => !coreBundles.some((b) => b.marketingId === id)),
                })
              }
            />
            {coreBundles.map((b) => (
              <Choice
                key={b.marketingId}
                pressed={state.bundleIds.includes(b.marketingId)}
                title={ui.bundles[b.marketingId]?.name ?? b.name}
                price={`−${b.discountPercent}%`}
                note={ui.bundles[b.marketingId]?.moduleLine}
                onClick={() => onChange(toggleBundle(state, b.marketingId, catalog))}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
      <h3 className="mb-2 mt-4 text-[13px] font-semibold text-[#34495E]">{copy.modules}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {standards.map((mod) => {
          const key = mod.moduleKeys[0]!;
          const inBundle = covered.has(key);
          const row = catalog.modules.find((m) => m.key === key);
          return (
            <Choice
              key={mod.id}
              pressed={inBundle || state.moduleKeys.includes(key)}
              disabled={inBundle}
              title={ui.standardModules[mod.id]?.name ?? row?.name ?? key}
              price={fmtAzn(row?.pricePerMonth ?? mod.pricePerMonthAzn)}
              note={inBundle ? copy.includedInBundle : ui.standardModules[mod.id]?.subtitle}
              onClick={() => onChange(toggleModule(state, key, catalog))}
            />
          );
        })}
      </div>
      {(snapshot.premiumModules ?? []).length > 0 ? (
        <>
          <h3 className="mb-2 mt-4 text-[13px] font-semibold text-[#34495E]">{copy.premium}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(snapshot.premiumModules ?? []).map((mod) => (
              <Choice
                key={mod.key}
                pressed={state.moduleKeys.includes(mod.key)}
                title={mod.name}
                price={fmtAzn(mod.pricePerMonth)}
                note={ui.premiumFeatures[mod.key]?.description}
                onClick={() => onChange(toggleModule(state, mod.key, catalog))}
              />
            ))}
          </div>
        </>
      ) : null}
    </Section>
  );
}

function SatellitesSection({
  copy,
  ui,
  catalog,
  snapshot,
  state,
  active,
  covered,
  onChange,
}: {
  copy: CalcCopy;
  ui: PricingStorefrontUiCopy;
  catalog: QuoteCatalog;
  snapshot: PublicPricingResponse;
  state: CalcState;
  active: Set<string>;
  covered: Set<string>;
  onChange: (next: CalcState) => void;
}) {
  return (
    <Section id="calc-satellites" title={copy.satellitesTitle} intro={copy.satellitesIntro}>
      <div className="space-y-3">
        {(snapshot.industryGroups ?? []).map((group) => {
          const on = active.has(group.satelliteKey) || state.moduleKeys.includes(group.satelliteKey);
          const meta = ui.industryCopy[group.satelliteKey];
          const driver = group.capacity;
          return (
            <div key={group.satelliteKey} className="rounded-2xl border border-[#D5DADF] p-3">
              <Choice
                pressed={on}
                title={meta?.title ?? group.gate?.name ?? group.satelliteKey}
                price={group.gate ? fmtAzn(group.gate.pricePerMonth) : undefined}
                note={meta?.intro}
                onClick={() => {
                  const withGate = state.moduleKeys.includes(group.satelliteKey)
                    ? state
                    : { ...state, moduleKeys: [...state.moduleKeys, group.satelliteKey] };
                  onChange(toggleModule(on ? withGate : state, group.satelliteKey, catalog));
                }}
              />
              {on ? (
                <div className="mt-3 space-y-3 border-t border-[#D5DADF]/80 pt-3">
                  {group.note === "banking_sandbox" ? (
                    <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                      {ui.bankingSandboxNote}
                    </p>
                  ) : null}
                  {group.bundles.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.bundles.map((b) => (
                        <Choice
                          key={b.marketingId}
                          pressed={state.bundleIds.includes(b.marketingId)}
                          title={ui.bundles[b.marketingId]?.name ?? b.name}
                          price={fmtAzn(b.discountedPriceAzn)}
                          note={ui.bundles[b.marketingId]?.moduleLine ?? `−${b.discountPercent}%`}
                          onClick={() => onChange(toggleBundle(state, b.marketingId, catalog))}
                        />
                      ))}
                    </div>
                  ) : null}
                  {group.modules.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.modules.map((mod) => {
                        const inBundle = covered.has(mod.key);
                        return (
                          <Choice
                            key={mod.key}
                            pressed={inBundle || state.moduleKeys.includes(mod.key) || active.has(mod.key)}
                            disabled={inBundle}
                            title={skuName(mod.key, mod.name, ui)}
                            price={fmtAzn(mod.pricePerMonth)}
                            note={inBundle ? copy.includedInBundle : undefined}
                            onClick={() => onChange(toggleModule(state, mod.key, catalog))}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                  {driver ? (
                    <Qty
                      label={`${copy.capacity} · ${meta?.capacityUnit ?? driver.unit}`}
                      hint={`${driver.includedInGate} ${copy.capacityIncluded}, +${fmtAzn(driver.unitAzn)}`}
                      value={state.capacity[group.satelliteKey] ?? driver.includedInGate}
                      min={0}
                      max={5000}
                      onChange={(n) => onChange({ ...state, capacity: { ...state.capacity, [group.satelliteKey]: n } })}
                    />
                  ) : null}
                  {group.satelliteKey === "industry_clinic" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Qty
                        label={copy.clinicRooms}
                        hint={copy.clinicRoomsHint}
                        value={state.clinicRooms}
                        min={0}
                        max={500}
                        onChange={(clinicRooms) => onChange({ ...state, clinicRooms })}
                      />
                      <Qty
                        label={copy.clinicBeds}
                        hint={copy.clinicBedsHint}
                        value={state.clinicBeds}
                        min={0}
                        max={500}
                        onChange={(clinicBeds) => onChange({ ...state, clinicBeds })}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function AddonsSection({
  copy,
  ui,
  catalog,
  snapshot,
  state,
  onChange,
}: {
  copy: CalcCopy;
  ui: PricingStorefrontUiCopy;
  catalog: QuoteCatalog;
  snapshot: PublicPricingResponse;
  state: CalcState;
  onChange: (next: CalcState) => void;
}) {
  const addons = snapshot.platformAddons ?? [];
  const hub = addons.filter((a) => DATA_HUB.includes(a.key));
  const domain = addons.filter((a) => DOMAIN.includes(a.key));
  const rest = addons.filter((a) => !DATA_HUB.includes(a.key) && !DOMAIN.includes(a.key) && a.key !== "platform_onsite_visit");
  const visit = addons.find((a) => a.key === "platform_onsite_visit");
  const rank = workforceRank(state.moduleKeys);
  const selectedHub = hub.find((a) => state.moduleKeys.includes(a.key))?.key ?? "";
  const selectedDomain = domain.find((a) => state.moduleKeys.includes(a.key))?.key ?? "";

  function pickXor(group: string[], key: string) {
    const stripped = state.moduleKeys.filter((k) => !group.includes(k));
    onChange({ ...state, moduleKeys: key ? toggleModule({ ...state, moduleKeys: stripped }, key, catalog).moduleKeys : stripped });
  }

  return (
    <Section id="calc-addons" title={copy.addonsTitle} intro={copy.addonsIntro}>
      {hub.length > 0 ? (
        <RadioRow
          label={copy.dataHub}
          none={copy.none}
          value={selectedHub}
          options={hub.map((a) => ({ id: a.key, label: `${skuName(a.key, a.name, ui)} · ${fmtAzn(a.pricePerMonth)}` }))}
          onChange={(id) => pickXor(DATA_HUB, id)}
        />
      ) : null}
      {domain.length > 0 ? (
        <div className="mt-3">
          <RadioRow
            label={copy.domain}
            none={copy.none}
            value={selectedDomain}
            options={domain.map((a) => ({ id: a.key, label: `${skuName(a.key, a.name, ui)} · ${fmtAzn(a.pricePerMonth)}` }))}
            onChange={(id) => pickXor(DOMAIN, id)}
          />
        </div>
      ) : null}
      <div className="mt-3 rounded-2xl border border-[#D5DADF] p-3">
        <p className="m-0 text-[13px] font-semibold text-[#34495E]">{copy.workforce}</p>
        <p className="mt-1 text-[12px] text-[#7F8C8D]">{copy.workforceHint}</p>
        <RadioRow
          label={copy.workforce}
          none={copy.none}
          value={rank === 0 ? "" : String(rank)}
          options={[
            { id: "1", label: copy.workforceEssential },
            { id: "2", label: copy.workforcePro },
            { id: "3", label: copy.workforcePremium },
          ]}
          onChange={(id) => onChange(setWorkforcePackage(state, (id ? Number(id) : 0) as 0 | 1 | 2 | 3))}
        />
        {rank > 0 ? (
          <div className="mt-3">
            <Qty
              label={copy.headcount}
              value={state.workforceHeadcount}
              min={0}
              max={20000}
              onChange={(workforceHeadcount) => onChange({ ...state, workforceHeadcount })}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rest.map((mod) => (
          <Choice
            key={mod.key}
            pressed={state.moduleKeys.includes(mod.key)}
            title={skuName(mod.key, mod.name, ui)}
            price={fmtAzn(mod.pricePerMonth)}
            onClick={() => onChange(toggleModule(state, mod.key, catalog))}
          />
        ))}
      </div>
      {visit ? (
        <div className="mt-3">
          <Choice
            pressed={state.moduleKeys.includes(visit.key)}
            title={skuName(visit.key, visit.name, ui)}
            price={fmtAzn(visit.pricePerMonth)}
            note={`${copy.oneShot}. ${copy.oneShotHint}`}
            onClick={() => onChange(toggleModule(state, visit.key, catalog))}
          />
        </div>
      ) : null}
    </Section>
  );
}

function UsageSection({
  copy,
  state,
  onChange,
}: {
  copy: CalcCopy;
  state: CalcState;
  onChange: (next: CalcState) => void;
}) {
  const set = (partial: Partial<CalcState>) => onChange({ ...state, ...partial });
  return (
    <Section id="calc-usage" title={copy.usageTitle} intro={copy.usageIntro}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Qty label={copy.erpLogins} hint={copy.erpHint} value={state.erpLogins} min={0} max={500} onChange={(erpLogins) => set({ erpLogins })} />
        <Qty label={copy.legalEntities} value={state.legalEntities} min={1} max={100} onChange={(legalEntities) => set({ legalEntities })} />
        <Qty label={copy.documents} value={state.documentsPerMonth} min={0} max={1000000} onChange={(documentsPerMonth) => set({ documentsPerMonth })} />
        <Qty label={copy.ocr} value={state.ocrPages} min={0} max={1000000} onChange={(ocrPages) => set({ ocrPages })} />
        <Qty label={copy.storage} value={state.storageGb} min={0} max={100000} onChange={(storageGb) => set({ storageGb })} />
        <Qty label={copy.whatsapp} value={state.whatsappMessages} min={0} max={1000000} onChange={(whatsappMessages) => set({ whatsappMessages })} />
        <Qty label={copy.sms} value={state.smsMessages} min={0} max={1000000} onChange={(smsMessages) => set({ smsMessages })} />
        <Qty
          label={copy.acquiring}
          value={Math.round(state.acquiringTurnoverAzn)}
          min={0}
          max={100000000}
          onChange={(n) => set({ acquiringTurnoverAzn: n })}
        />
        <Qty label={copy.tradeBuyers} value={state.tradeCreditBuyers} min={0} max={100000} onChange={(tradeCreditBuyers) => set({ tradeCreditBuyers })} />
        <Qty label={copy.tradeEnrich} value={state.tradeCreditEnrich} min={0} max={100000} onChange={(tradeCreditEnrich) => set({ tradeCreditEnrich })} />
      </div>
    </Section>
  );
}

function QuoteCard({
  copy,
  ui,
  catalog,
  quote,
  yearly,
  copied,
  onYearly,
  onShare,
}: {
  copy: CalcCopy;
  ui: PricingStorefrontUiCopy;
  catalog: QuoteCatalog;
  quote: QuoteResult | null;
  yearly: boolean;
  copied: boolean;
  onYearly: (yearly: boolean) => void;
  onShare: () => void;
}) {
  const groups: Array<QuoteLine["group"]> = ["subscription", "capacity", "people", "usage", "once"];
  const groupLabel: Record<QuoteLine["group"], string> = {
    subscription: copy.subscription,
    capacity: copy.capacityGroup,
    people: copy.people,
    usage: copy.usage,
    once: copy.once,
  };
  return (
    <aside id="calc-quote" className="lg:sticky lg:top-24 rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-sm md:p-5">
      <h2 className="m-0 text-lg font-bold text-[#34495E]">{copy.quoteTitle}</h2>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-[#34495E]">
        <input type="checkbox" checked={yearly} onChange={(e) => onYearly(e.target.checked)} />
        {copy.yearlyToggle}
        {catalog.yearlyDiscountPercent > 0 ? <span className="text-[#2980B9]">−{catalog.yearlyDiscountPercent}%</span> : null}
      </label>
      {!quote || quote.lines.length === 0 ? (
        <p className="mt-4 text-[13px] text-[#7F8C8D]">{copy.empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((group) => {
            const rows = quote.lines.filter((l) => l.group === group);
            if (rows.length === 0) return null;
            return (
              <div key={group}>
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{groupLabel[group]}</p>
                <ul className="m-0 mt-1 list-none space-y-1 p-0">
                  {rows.map((line) => (
                    <li key={line.id} className="flex items-start justify-between gap-3 text-[13px]">
                      <span className="text-[#34495E]">
                        {lineLabel(line, copy, ui)}
                        {line.kind === "bundle" && line.listAzn != null && line.listAzn > line.amountAzn ? (
                          <span className="mt-0.5 block text-[11px] text-[#7F8C8D] line-through">
                            {fmtAzn(line.listAzn)} {copy.listPrice}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-[#34495E]">{fmtAzn(line.amountAzn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {quote ? (
        <div className="mt-4 border-t border-[#D5DADF] pt-3">
          <Row label={copy.recurring} value={fmtAzn(quote.recurringPerMonthAzn)} />
          <Row label={copy.usageEstimate} value={fmtAzn(quote.usageMonthlyAzn)} />
          <p className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold text-[#34495E]">{copy.monthlyTotal}</span>
            <span className="text-2xl font-bold tabular-nums text-[#2980B9]" data-testid="calc-monthly-total">
              {fmtAzn(quote.monthlyTotalAzn)}
            </span>
          </p>
          {yearly ? (
            <Row label={copy.yearlyTotal} value={fmtAzn(quote.yearlySubscriptionAzn)} />
          ) : null}
          {quote.oneTimeAzn > 0 ? <Row label={copy.once} value={fmtAzn(quote.oneTimeAzn)} /> : null}
        </div>
      ) : null}
      {quote && quote.warnings.length > 0 ? (
        <ul className="mt-3 list-none space-y-2 p-0">
          {quote.warnings.map((id) => (
            <li key={id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-950">
              {copy.warnings[id]}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-[12px] leading-snug text-[#7F8C8D]">{copy.trialNote}</p>
      <p className="mt-1 text-[12px] leading-snug text-[#7F8C8D]">{copy.bakuNote}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Link href="/register-org" className={`${PRIMARY_BUTTON_CLASS} h-11 text-sm no-underline`}>
          {copy.register}
        </Link>
        <button type="button" className={`${SECONDARY_BUTTON_CLASS} h-10 text-sm`} onClick={onShare}>
          {copied ? copy.copied : copy.share}
        </button>
        <Link href="/pricing" className="text-center text-[12px] font-semibold text-[#2980B9] no-underline">
          {copy.catalog}
        </Link>
      </div>
    </aside>
  );
}

function lineLabel(line: QuoteLine, copy: CalcCopy, ui: PricingStorefrontUiCopy): string {
  if (line.kind === "foundation") return copy.line.foundation;
  if (line.kind === "bundle") return line.name ?? line.key ?? "";
  if (line.kind === "module" || line.kind === "oneShot") return line.key ? skuName(line.key, line.name ?? line.key, ui) : (line.name ?? "");
  if (line.kind === "capacity") {
    const title = line.key ? ui.industryCopy[line.key]?.title ?? line.key : "";
    return `${title}: ${copy.line.capacity} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  }
  if (line.kind === "clinicRooms") return `${copy.line.clinicRooms} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "clinicBeds") return `${copy.line.clinicBeds} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "workforce") return `${copy.line.workforce} ${line.headcount} × ${fmtAzn(line.rate ?? 0)}`;
  if (line.kind === "erpLogins") return `${copy.line.erp} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "legal") return `${copy.line.legal} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "documents") return `${copy.line.documents} × ${line.extra}`;
  if (line.kind === "ocr") return `${copy.line.ocr} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "storage") return `${copy.line.storage} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "whatsapp") return `${copy.line.whatsapp} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "sms") return `${copy.line.sms} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "acquiring") return copy.line.acquiring;
  if (line.kind === "tradeBuyers") return `${copy.line.tradeBuyers} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  if (line.kind === "tradeEnrich") return `${copy.line.tradeEnrich} ${line.extra} × ${fmtAzn(line.unitAzn ?? 0)}`;
  return line.name ?? line.kind;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="m-0 mt-1 flex items-baseline justify-between gap-3 text-[13px] text-[#7F8C8D]">
      <span>{label}</span>
      <span className="tabular-nums text-[#34495E]">{value}</span>
    </p>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-sm md:p-5">
      <h2 className="m-0 text-lg font-bold tracking-tight text-[#34495E]">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[#7F8C8D]">{intro}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Choice({
  pressed,
  disabled,
  title,
  price,
  note,
  onClick,
}: {
  pressed: boolean;
  disabled?: boolean;
  title: string;
  price?: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition ${
        pressed ? "border-[#2980B9] bg-[#2980B9]/5" : "border-[#D5DADF] bg-white hover:border-[#2980B9]/50"
      } ${disabled ? "cursor-default" : ""}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#34495E]">{title}</span>
        {price ? <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#2980B9]">{price}</span> : null}
      </span>
      {note ? <span className="mt-1 block text-[12px] leading-snug text-[#7F8C8D]">{note}</span> : null}
    </button>
  );
}

function Qty({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="block">
      <span className="text-[13px] font-semibold text-[#34495E]">{label}</span>
      {hint ? <span className="mt-0.5 block text-[12px] leading-snug text-[#7F8C8D]">{hint}</span> : null}
      <span className="mt-2 inline-flex items-center rounded-xl border border-[#D5DADF] bg-white">
        <button type="button" className="h-10 w-10 text-lg text-[#34495E]" aria-label={`${label} −`} onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <input
          className="h-10 w-20 border-0 bg-transparent text-center text-sm tabular-nums text-[#34495E] outline-none"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^\d]/g, ""));
            onChange(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));
          }}
        />
        <button type="button" className="h-10 w-10 text-lg text-[#34495E]" aria-label={`${label} +`} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </span>
    </div>
  );
}

function RadioRow({
  label,
  none,
  value,
  options,
  onChange,
}: {
  label: string;
  none: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold ${value === "" ? "border-[#2980B9] bg-[#2980B9]/5 text-[#2980B9]" : "border-[#D5DADF] text-[#34495E]"}`}>
          <input className="sr-only" type="radio" name={label} checked={value === ""} onChange={() => onChange("")} />
          {none}
        </label>
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold ${value === opt.id ? "border-[#2980B9] bg-[#2980B9]/5 text-[#2980B9]" : "border-[#D5DADF] text-[#34495E]"}`}
          >
            <input className="sr-only" type="radio" name={label} checked={value === opt.id} onChange={() => onChange(opt.id)} />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
