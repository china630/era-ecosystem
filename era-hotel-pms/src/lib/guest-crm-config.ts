import type { ActionItem } from '@/components/guest-card/GuestCardActionGrid';
import { financeGuestDeepLink } from '@/lib/finance-links';
import {
  clinicGuestDeepLink,
  logisticsGuestDeepLink,
  posGuestDeepLink,
  type ClinicGuestSection,
} from '@/lib/satellite-links';

export type CrmModule = 'hotel' | 'clinic' | 'finance' | 'logistics' | 'pos' | 'deferred';

export type CrmButtonConfig = {
  buttonId: string;
  labelKey: string;
  module: CrmModule;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** hotel path template with {id} */
  hrefTemplate?: string;
  /** Opens an in-card panel instead of leaving the guest card. */
  panelId?: string;
  clinicSection?: ClinicGuestSection;
  financeTarget?: 'folios' | 'expenses';
  disabled?: boolean;
  deferredReasonKey?: string;
  badgeKey?: 'specialNotes' | 'allergens';
};

function hotelHref(template: string, guestId: string | null): string | undefined {
  if (!guestId) return undefined;
  return template.replace('{id}', guestId);
}

function resolveHref(cfg: CrmButtonConfig, guestId: string | null): string | undefined {
  if (!guestId || cfg.disabled || cfg.panelId) return undefined;
  if (cfg.hrefTemplate) return hotelHref(cfg.hrefTemplate, guestId);
  if (cfg.module === 'clinic' && cfg.clinicSection) {
    const link = clinicGuestDeepLink(guestId, cfg.clinicSection);
    return link ?? undefined;
  }
  if (cfg.module === 'finance' && cfg.financeTarget) {
    const link = financeGuestDeepLink(guestId, cfg.financeTarget);
    return link ?? undefined;
  }
  if (cfg.module === 'logistics') {
    const link = logisticsGuestDeepLink(guestId);
    return link ?? undefined;
  }
  if (cfg.module === 'pos') {
    const link = posGuestDeepLink(guestId);
    return link ?? undefined;
  }
  return undefined;
}

function isExternal(cfg: CrmButtonConfig): boolean {
  return ['clinic', 'finance', 'logistics', 'pos'].includes(cfg.module);
}

export function buildActionItems(
  configs: CrmButtonConfig[],
  guestId: string | null,
  badges?: Partial<Record<'specialNotes' | 'allergens', number>>,
): ActionItem[] {
  return configs.map((cfg) => {
    const href = resolveHref(cfg, guestId);
    const needsGuest = cfg.module !== 'deferred';
    const unconfiguredSatellite =
      needsGuest &&
      !cfg.disabled &&
      !cfg.hrefTemplate &&
      ['clinic', 'finance', 'logistics', 'pos'].includes(cfg.module) &&
      !href;
    const disabled = cfg.disabled || !guestId || unconfiguredSatellite || Boolean(cfg.panelId && !guestId);
    const badgeCount =
      cfg.badgeKey && badges?.[cfg.badgeKey] ? badges[cfg.badgeKey] : undefined;
    return {
      buttonId: cfg.buttonId,
      labelKey: cfg.labelKey,
      href: disabled || cfg.panelId ? undefined : href,
      panelId: disabled ? undefined : cfg.panelId,
      disabled,
      external: Boolean(href && isExternal(cfg)),
      disabledReasonKey: cfg.deferredReasonKey ?? (unconfiguredSatellite ? 'satellite.notConfigured' : undefined),
      badgeCount,
    };
  });
}

const CRM_TAB: CrmButtonConfig[] = [
  { buttonId: 'tasks', labelKey: 'crm.tasks', module: 'hotel', priority: 'P0', panelId: 'tasks' },
  { buttonId: 'notes', labelKey: 'crm.generalNotes', module: 'hotel', priority: 'P0', panelId: 'notes' },
  { buttonId: 'document_archive', labelKey: 'crm.documentArchive', module: 'hotel', priority: 'P0', panelId: 'archive' },
  { buttonId: 'tags', labelKey: 'crm.tags', module: 'hotel', priority: 'P1', panelId: 'tags' },
  { buttonId: 'preferences', labelKey: 'crm.preferences', module: 'hotel', priority: 'P1', panelId: 'preferences' },
  { buttonId: 'allergens', labelKey: 'crm.allergens', module: 'hotel', priority: 'P1', panelId: 'allergens', badgeKey: 'allergens' },
  { buttonId: 'special_dates', labelKey: 'crm.specialDates', module: 'hotel', priority: 'P1', panelId: 'special-dates' },
  { buttonId: 'special_guest_notes', labelKey: 'crm.specialGuestNotes', module: 'hotel', priority: 'P1', panelId: 'special-notes', badgeKey: 'specialNotes' },
  { buttonId: 'favorite_room', labelKey: 'crm.favoriteRoom', module: 'hotel', priority: 'P1', panelId: 'favorites' },
  { buttonId: 'health_info', labelKey: 'crm.healthInfo', module: 'clinic', priority: 'P0', clinicSection: 'health' },
  { buttonId: 'lab_test_results', labelKey: 'crm.labTestResults', module: 'clinic', priority: 'P0', clinicSection: 'labs' },
  { buttonId: 'expenses', labelKey: 'crm.expenses', module: 'finance', priority: 'P1', financeTarget: 'expenses' },
  { buttonId: 'comments', labelKey: 'crm.comments', module: 'hotel', priority: 'P1', panelId: 'comments' },
  { buttonId: 'surveys', labelKey: 'crm.surveys', module: 'hotel', priority: 'P1', panelId: 'surveys' },
  { buttonId: 'reclaim_comments', labelKey: 'crm.reclaimComments', module: 'hotel', priority: 'P1', panelId: 'reclaims' },
  { buttonId: 'incident_report', labelKey: 'crm.incidentReport', module: 'hotel', priority: 'P1', panelId: 'incidents' },
  { buttonId: 'whatsapp_messages', labelKey: 'crm.whatsappJournal', module: 'hotel', priority: 'P1', panelId: 'whatsapp' },
  { buttonId: 'send_emails', labelKey: 'crm.emailJournal', module: 'hotel', priority: 'P2', panelId: 'emails' },
  { buttonId: 'send_sms', labelKey: 'crm.smsJournal', module: 'hotel', priority: 'P2', panelId: 'sms' },
  { buttonId: 'contact_logs', labelKey: 'crm.contactLogs', module: 'hotel', priority: 'P2', panelId: 'contact-logs' },
  { buttonId: 'transfers', labelKey: 'crm.transfers', module: 'hotel', priority: 'P0', hrefTemplate: '/transfers?guestId={id}' },
  { buttonId: 'interests_hobbies', labelKey: 'crm.interests', module: 'hotel', priority: 'P2', panelId: 'interests' },
  { buttonId: 'social_media', labelKey: 'crm.socialMedia', module: 'hotel', priority: 'P2', panelId: 'social-media' },
  { buttonId: 'general_crm', labelKey: 'crm.generalCrm', module: 'hotel', priority: 'P2', panelId: 'general-crm' },
];

const RES_DETAILS: CrmButtonConfig[] = [
  { buttonId: 'reservations', labelKey: 'resDetail.reservations', module: 'hotel', priority: 'P0', panelId: 'reservations' },
  { buttonId: 'transfers', labelKey: 'resDetail.transfers', module: 'hotel', priority: 'P0', hrefTemplate: '/transfers?guestId={id}' },
  { buttonId: 'lost_and_found', labelKey: 'resDetail.lostAndFound', module: 'hotel', priority: 'P1', hrefTemplate: '/hk/lost-and-found?guestId={id}' },
  { buttonId: 'guest_all_folio', labelKey: 'resDetail.guestAllFolio', module: 'finance', priority: 'P1', financeTarget: 'folios' },
  { buttonId: 'accompanying_guests', labelKey: 'resDetail.accompanying', module: 'hotel', priority: 'P1', panelId: 'accompanying' },
  { buttonId: 'family_members', labelKey: 'resDetail.familyMembers', module: 'hotel', priority: 'P1', panelId: 'family' },
  { buttonId: 'booker', labelKey: 'resDetail.booker', module: 'hotel', priority: 'P1', panelId: 'booker' },
  { buttonId: 'reservation_sources', labelKey: 'resDetail.reservationSources', module: 'hotel', priority: 'P1', panelId: 'sources' },
  { buttonId: 'trip_reasons', labelKey: 'resDetail.tripReasons', module: 'hotel', priority: 'P1', panelId: 'trip-reasons' },
];

export function crmTabButtons(guestId: string | null, badges?: Partial<Record<'specialNotes' | 'allergens', number>>) {
  return buildActionItems(CRM_TAB, guestId, badges);
}

export function reservationDetailsButtons(
  guestId: string | null,
  badges?: Partial<Record<'specialNotes' | 'allergens', number>>,
) {
  return buildActionItems(RES_DETAILS, guestId, badges);
}
