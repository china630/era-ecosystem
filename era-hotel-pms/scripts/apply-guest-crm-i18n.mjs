#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function setAt(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deepMergeMissing(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] ?? {};
      deepMergeMissing(target[k], v);
    } else if (target[k] === undefined) {
      target[k] = v;
    }
  }
}

const en = JSON.parse(fs.readFileSync(path.join(root, 'messages', 'en.json'), 'utf8'));
const maps = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'guest-crm-i18n.json'), 'utf8'));

const enPatches = {
  'guestCard.crm.generalNotes': 'Notes',
  'guestCard.crm.documentArchive': 'Document archive',
  'guestCard.crm.tags': 'Tags',
  'guestCard.crm.specialGuestNotes': 'Special guest notes',
  'guestCard.crm.favoriteRoom': 'Favorite room',
  'guestCard.crm.medicalFollowUp': 'Medical follow-up',
  'guestCard.crm.labTestEntry': 'Lab test entry',
  'guestCard.crm.labTestResults': 'Lab test results',
  'guestCard.crm.expenses': 'Expenses',
  'guestCard.crm.reclaimComments': 'Reclaims',
  'guestCard.crm.incidentReport': 'Incidents',
  'guestCard.crm.surveys': 'Surveys',
  'guestCard.crm.reviews': 'Review scores',
  'guestCard.crm.whatsapp': 'WhatsApp',
  'guestCard.crm.sendEmail': 'Send email',
  'guestCard.crm.sendSms': 'Send SMS',
  'guestCard.crm.contactLogs': 'Contact logs',
  'guestCard.crm.deferredP2': 'Planned in phase P2',
  'guestCard.crm.deferredP3': 'Planned in phase P3',
  'guestCard.crm.socialMedia': 'Social media',
  'guestCard.crm.references': 'References',
  'guestCard.crm.generalCrm': 'General CRM',
  'guestCard.crm.bonus': 'Bonuses',
  'guestCard.crm.buyingHabits': 'Buying habits',
  'guestCard.crm.membershipAgreements': 'Membership agreements',
  'guestCard.crm.externalReviews': 'External reviews',
  'guestCard.crm.mobileChat': 'Mobile chat',
  'guestCard.crm.loginDevices': 'Login devices',
  'guestCard.resDetail.lostAndFound': 'Lost & found',
  'guestCard.resDetail.guestAllFolio': 'All folios',
  'guestCard.resDetail.accompanying': 'Accompanying guests',
  'guestCard.resDetail.familyMembers': 'Family members',
  'guestCard.resDetail.booker': 'Booker history',
  'guestCard.resDetail.reservationSources': 'Reservation sources',
  'guestCard.resDetail.tripReasons': 'Trip reasons',
  'guestCard.resDetail.webCallRequests': 'Web/call requests',
  'guestCard.resDetail.calls': 'Calls',
  'guestCard.resDetail.autoTasks': 'Auto tasks',
  'guestCard.resDetail.otherHotels': 'Other hotels visited',
  'guestCard.satellite.notConfigured': 'Satellite URL not configured',
  'guestCard.satellite.openExternal': 'Opens in external module',
  'guestCard.crmPages.backToGuests': 'Back to guests',
  'guestCard.crmPages.empty': 'No records yet',
  'guestCard.crmPages.tagsTitle': 'Guest tags',
  'guestCard.crmPages.addTag': 'Add tag',
  'guestCard.crmPages.tagPrompt': 'Tag name',
  'guestCard.crmPages.archiveTitle': 'Document archive',
  'guestCard.crmPages.upload': 'Upload file',
  'guestCard.crmPages.docTypePrompt': 'Document type (ID, Voucher…)',
  'guestCard.crmPages.preferencesTitle': 'Preferences',
  'guestCard.crmPages.allergensTitle': 'Allergens',
  'guestCard.crmPages.specialDatesTitle': 'Special dates',
  'guestCard.crmPages.favoritesTitle': 'Favorite rooms',
  'guestCard.crmPages.specialNotesTitle': 'Special guest notes',
  'guestCard.crmPages.commentsTitle': 'Comments',
  'guestCard.crmPages.surveysTitle': 'Surveys',
  'guestCard.crmPages.reclaimsTitle': 'Reclaims',
  'guestCard.crmPages.incidentsTitle': 'Incidents',
  'guestCard.crmPages.familyTitle': 'Family members',
  'guestCard.crmPages.accompanyingTitle': 'Accompanying guests',
  'guestCard.crmPages.bookerTitle': 'Booker reservations',
  'guestCard.crmPages.sourcesTitle': 'Reservation sources',
  'guestCard.crmPages.tripReasonsTitle': 'Trip reasons',
  'guestCard.crmPages.add': 'Add',
  'guestCard.allergenWarning': 'Guest has registered allergens',
};

for (const [dotPath, value] of Object.entries(enPatches)) {
  setAt(en, dotPath, value);
}
fs.writeFileSync(path.join(root, 'messages', 'en.json'), `${JSON.stringify(en, null, 2)}\n`);

for (const locale of ['az', 'ru']) {
  const file = path.join(root, 'messages', `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMergeMissing(data, en);
  for (const [dotPath, tr] of Object.entries(maps)) {
    if (tr[locale] !== undefined) setAt(data, dotPath, tr[locale]);
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
console.log('guest-crm i18n applied');
