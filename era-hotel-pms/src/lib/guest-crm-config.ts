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
  if (!guestId || cfg.disabled) return undefined;
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
    const disabled = cfg.disabled || !guestId || unconfiguredSatellite;
    const badgeCount =
      cfg.badgeKey && badges?.[cfg.badgeKey] ? badges[cfg.badgeKey] : undefined;
    return {
      buttonId: cfg.buttonId,
      labelKey: cfg.labelKey,
      href: disabled ? undefined : href,
      disabled,
      external: Boolean(href && isExternal(cfg)),
      disabledReasonKey: cfg.deferredReasonKey ?? (unconfiguredSatellite ? 'satellite.notConfigured' : undefined),
      badgeCount,
    };
  });
}

const CRM_TAB: CrmButtonConfig[] = [
  { buttonId: 'tasks', labelKey: 'crm.tasks', module: 'hotel', priority: 'P0', hrefTemplate: '/guests/{id}/tasks' },
  { buttonId: 'notes', labelKey: 'crm.generalNotes', module: 'hotel', priority: 'P0', hrefTemplate: '/guests/{id}/notes' },
  { buttonId: 'document_archive', labelKey: 'crm.documentArchive', module: 'hotel', priority: 'P0', hrefTemplate: '/guests/{id}/archive' },
  { buttonId: 'tags', labelKey: 'crm.tags', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/tags' },
  { buttonId: 'preferences', labelKey: 'crm.preferences', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/preferences' },
  { buttonId: 'allergens', labelKey: 'crm.allergens', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/allergens', badgeKey: 'allergens' },
  { buttonId: 'special_dates', labelKey: 'crm.specialDates', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/special-dates' },
  { buttonId: 'special_guest_notes', labelKey: 'crm.specialGuestNotes', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/special-notes', badgeKey: 'specialNotes' },
  { buttonId: 'favorite_room', labelKey: 'crm.favoriteRoom', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/favorites' },
  { buttonId: 'health_info', labelKey: 'crm.healthInfo', module: 'clinic', priority: 'P0', clinicSection: 'health' },
  { buttonId: 'medical_history', labelKey: 'crm.medicalHistory', module: 'clinic', priority: 'P0', clinicSection: 'history' },
  { buttonId: 'medical_follow_up', labelKey: 'crm.medicalFollowUp', module: 'clinic', priority: 'P0', clinicSection: 'followUp' },
  { buttonId: 'lab_test_entry', labelKey: 'crm.labTestEntry', module: 'clinic', priority: 'P0', clinicSection: 'labsNew' },
  { buttonId: 'lab_test_results', labelKey: 'crm.labTestResults', module: 'clinic', priority: 'P0', clinicSection: 'labs' },
  { buttonId: 'facility_reservations', labelKey: 'crm.facilityReservations', module: 'hotel', priority: 'P1', hrefTemplate: '/procedures?guestId={id}' },
  { buttonId: 'expenses', labelKey: 'crm.expenses', module: 'finance', priority: 'P1', financeTarget: 'expenses' },
  { buttonId: 'comments', labelKey: 'crm.comments', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/comments' },
  { buttonId: 'surveys', labelKey: 'crm.surveys', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/surveys' },
  { buttonId: 'reclaim_comments', labelKey: 'crm.reclaimComments', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/reclaims' },
  { buttonId: 'incident_report', labelKey: 'crm.incidentReport', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/incidents' },
  { buttonId: 'reviews', labelKey: 'crm.reviews', module: 'hotel', priority: 'P2', hrefTemplate: '/guests/{id}/surveys' },
  { buttonId: 'whatsapp_messages', labelKey: 'crm.whatsapp', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/whatsapp' },
  { buttonId: 'send_emails', labelKey: 'crm.sendEmail', module: 'hotel', priority: 'P2', hrefTemplate: '/guests/{id}/emails' },
  { buttonId: 'send_sms', labelKey: 'crm.sendSms', module: 'hotel', priority: 'P2', hrefTemplate: '/guests/{id}/sms' },
  { buttonId: 'contact_logs', labelKey: 'crm.contactLogs', module: 'hotel', priority: 'P2', hrefTemplate: '/guests/{id}/contact-logs' },
  { buttonId: 'transfers', labelKey: 'crm.transfers', module: 'hotel', priority: 'P0', hrefTemplate: '/transfers?guestId={id}' },
  { buttonId: 'interests_hobbies', labelKey: 'crm.interests', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'social_media', labelKey: 'crm.socialMedia', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'references', labelKey: 'crm.references', module: 'deferred', priority: 'P3', disabled: true, deferredReasonKey: 'crm.deferredP3' },
  { buttonId: 'general_crm', labelKey: 'crm.generalCrm', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'bonus', labelKey: 'crm.bonus', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'buying_habits', labelKey: 'crm.buyingHabits', module: 'pos', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'membership_agreements', labelKey: 'crm.membershipAgreements', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'external_reviews', labelKey: 'crm.externalReviews', module: 'deferred', priority: 'P3', disabled: true, deferredReasonKey: 'crm.deferredP3' },
  { buttonId: 'mobile_chat', labelKey: 'crm.mobileChat', module: 'deferred', priority: 'P3', disabled: true, deferredReasonKey: 'crm.deferredP3' },
  { buttonId: 'login_devices', labelKey: 'crm.loginDevices', module: 'deferred', priority: 'P3', disabled: true, deferredReasonKey: 'crm.deferredP3' },
  { buttonId: 'guest_registry', labelKey: 'crm.guestRegistry', module: 'hotel', priority: 'P2', hrefTemplate: '/guests' },
];

const RES_DETAILS: CrmButtonConfig[] = [
  { buttonId: 'reservations', labelKey: 'resDetail.reservations', module: 'hotel', priority: 'P0', hrefTemplate: '/reports/reservations?guestId={id}' },
  { buttonId: 'transfers', labelKey: 'resDetail.transfers', module: 'hotel', priority: 'P0', hrefTemplate: '/transfers?guestId={id}' },
  { buttonId: 'lost_and_found', labelKey: 'resDetail.lostAndFound', module: 'hotel', priority: 'P1', hrefTemplate: '/housekeeping/lost-and-found?guestId={id}' },
  { buttonId: 'guest_all_folio', labelKey: 'resDetail.guestAllFolio', module: 'finance', priority: 'P1', financeTarget: 'folios' },
  { buttonId: 'group_hotels_visiting', labelKey: 'resDetail.groups', module: 'hotel', priority: 'P2', hrefTemplate: '/reports/group-reservations?guestId={id}' },
  { buttonId: 'accompanying_guests', labelKey: 'resDetail.accompanying', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/accompanying' },
  { buttonId: 'family_members', labelKey: 'resDetail.familyMembers', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/family' },
  { buttonId: 'booker', labelKey: 'resDetail.booker', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/booker-history' },
  { buttonId: 'reservation_sources', labelKey: 'resDetail.reservationSources', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/sources' },
  { buttonId: 'trip_reasons', labelKey: 'resDetail.tripReasons', module: 'hotel', priority: 'P1', hrefTemplate: '/guests/{id}/trip-reasons' },
  { buttonId: 'in_house', labelKey: 'resDetail.inHouse', module: 'hotel', priority: 'P1', hrefTemplate: '/in-house' },
  { buttonId: 'web_call_requests', labelKey: 'resDetail.webCallRequests', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'calls', labelKey: 'resDetail.calls', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'auto_tasks', labelKey: 'resDetail.autoTasks', module: 'deferred', priority: 'P2', disabled: true, deferredReasonKey: 'crm.deferredP2' },
  { buttonId: 'other_hotels_visited', labelKey: 'resDetail.otherHotels', module: 'deferred', priority: 'P3', disabled: true, deferredReasonKey: 'crm.deferredP3' },
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
