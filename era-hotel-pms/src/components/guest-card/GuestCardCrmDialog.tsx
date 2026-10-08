'use client';

import { useContext, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import { GuestCrmPromptListPage, GuestCrmReadOnly } from '@/components/guest-crm/GuestCrmPromptListPage';
import { GuestCrmExtensionPage } from '@/components/guest-crm/GuestCrmExtensionPage';
import { useGuestCrmList } from '@/components/guest-crm/useGuestCrmList';
import { guestListItems } from '@/lib/guest-list-identity';

function ReadList({
  guestId,
  path,
  line,
  onOpen,
}: {
  guestId: string;
  path: string;
  line: (row: Record<string, unknown>) => string;
  onOpen?: (row: Record<string, unknown>) => void;
}) {
  const t = useTranslations('guestCard');
  const { rows } = useGuestCrmList(path.replace('{id}', guestId));
  if (rows.length === 0) return <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>;
  return (
    <ul className="space-y-2 text-[13px]">
      {rows.map((r) => (
        <li key={String(r.id)}>
          {onOpen ? (
            <button
              type="button"
              className="w-full rounded-xl border border-[#D5DADF] p-3 text-left hover:bg-[#F4F6F7]"
              onClick={() => onOpen(r)}
            >
              {line(r)}
            </button>
          ) : (
            <div className="rounded-xl border border-[#D5DADF] p-3">{line(r)}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function AnalyticsList({
  guestId,
  field,
  line,
}: {
  guestId: string;
  field: 'sources' | 'tripReasons';
  line: (row: Record<string, unknown>) => string;
}) {
  const t = useTranslations('guestCard');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    void fetch(`/api/guests/${guestId}/reservation-analytics`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data?.[field]) ? data[field] : []));
  }, [guestId, field]);
  if (rows.length === 0) return <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>;
  return (
    <ul className="space-y-2 text-[13px]">
      {rows.map((r, i) => (
        <li key={String(r.id ?? i)} className="rounded-xl border border-[#D5DADF] p-3">
          {line(r)}
        </li>
      ))}
    </ul>
  );
}

function ReservationList({
  guestId,
  onOpen,
}: {
  guestId: string;
  onOpen: (reservationId: string) => void;
}) {
  const t = useTranslations('guestCard');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    void fetch(`/api/reservations?guestId=${encodeURIComponent(guestId)}&includeParty=1`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []));
  }, [guestId]);
  if (rows.length === 0) return <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>;
  return (
    <ul className="space-y-2 text-[13px]">
      {rows.map((r) => {
        const room = r.room as { roomNumber?: string } | null;
        return (
          <li key={String(r.id)}>
            <button
              type="button"
              className="w-full rounded-xl border border-[#D5DADF] p-3 text-left hover:bg-[#F4F6F7]"
              onClick={() => onOpen(String(r.id))}
            >
              {String(r.status ?? '')} · {String(r.checkInDate ?? '').slice(0, 10)} — {String(r.checkOutDate ?? '').slice(0, 10)}
              {room?.roomNumber ? ` · ${room.roomNumber}` : ''}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ArchivePanel({ guestId }: { guestId: string }) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const readOnly = useContext(GuestCrmReadOnly);
  const { rows, reload } = useGuestCrmList(`/api/guests/${guestId}/archive`);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim() || !docType.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), docType: docType.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json);
        return;
      }
      setTitle('');
      setDocType('');
      showSuccess(tc('success'));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {readOnly ? null : (
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={tc('name')} preset="shortText" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field
          label={t('crmPages.docTypePrompt')}
          preset="shortText"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy || !title.trim() || !docType.trim()} onClick={() => void add()}>
          {t('crmPages.add')}
        </button>
      </div>
      )}
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className="space-y-2 text-[13px]">
          {rows.map((r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.title ?? r.docType ?? '')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FamilyPanel({
  guestId,
  onOpenGuest,
}: {
  guestId: string;
  onOpenGuest?: (guestId: string) => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const readOnly = useContext(GuestCrmReadOnly);
  const { rows, reload } = useGuestCrmList(`/api/guests/${guestId}/family`);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Array<{ id: string; fullName: string }>>([]);
  const [relatedGuestId, setRelatedGuestId] = useState('');
  const [relatedLabel, setRelatedLabel] = useState('');
  const [relationship, setRelationship] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/guests?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((list) => {
          setHits(
            guestListItems(list)
              .filter((g) => g.id !== guestId)
              .slice(0, 8)
              .map((g) => ({ id: g.id, fullName: g.fullName })),
          );
        })
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, guestId]);

  async function add() {
    if (!relatedGuestId || !relationship.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${guestId}/family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedGuestId, relationship: relationship.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json);
        return;
      }
      setRelatedGuestId('');
      setRelatedLabel('');
      setQuery('');
      setRelationship('');
      showSuccess(tc('success'));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {readOnly ? null : (
      <div className="grid gap-2">
        <Field
          label={t('crmFields.relatedGuest')}
          preset="longText"
          value={relatedLabel || query}
          onChange={(e) => {
            setRelatedGuestId('');
            setRelatedLabel('');
            setQuery(e.target.value);
          }}
        />
        {hits.length > 0 ? (
          <ul className="m-0 list-none rounded-md border border-[#D5DADF] p-0">
            {hits.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-[13px] hover:bg-[#F4F6F7]"
                  onClick={() => {
                    setRelatedGuestId(g.id);
                    setRelatedLabel(g.fullName);
                    setQuery('');
                    setHits([]);
                  }}
                >
                  {g.fullName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label={t('crmFields.relationship')}
            preset="shortText"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !relatedGuestId || !relationship.trim()}
            onClick={() => void add()}
          >
            {t('crmPages.add')}
          </button>
        </div>
      </div>
      )}
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className="space-y-2 text-[13px]">
          {rows.map((r) => {
            const rel = r.relatedGuest as { fullName?: string } | undefined;
            const relatedId = typeof r.relatedGuestId === 'string' ? r.relatedGuestId : '';
            const label = `${rel?.fullName ?? relatedId} — ${String(r.relationship)}`;
            return (
              <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
                {onOpenGuest && relatedId ? (
                  <button
                    type="button"
                    className="text-left text-[#2980B9] hover:underline"
                    onClick={() => onOpenGuest(relatedId)}
                  >
                    {label}
                  </button>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function GuestCardCrmDialog({
  panelId,
  guestId,
  onClose,
  onOpenGuest,
  onOpenReservation,
  locked = false,
}: {
  panelId: string | null;
  guestId: string | null;
  onClose: () => void;
  onOpenGuest?: (guestId: string) => void;
  onOpenReservation?: (reservationId: string) => void;
  locked?: boolean;
}) {
  const t = useTranslations('guestCard');
  if (!panelId || !guestId) return null;

  const titleKey: Record<string, string> = {
    tasks: 'tasksPage.title',
    notes: 'notesPage.title',
    archive: 'crmPages.archiveTitle',
    tags: 'crmPages.tagsTitle',
    preferences: 'crmPages.preferencesTitle',
    allergens: 'crmPages.allergensTitle',
    'special-dates': 'crmPages.specialDatesTitle',
    'special-notes': 'crmPages.specialNotesTitle',
    favorites: 'crmPages.favoritesTitle',
    comments: 'crmPages.commentsTitle',
    surveys: 'crmPages.surveysTitle',
    reclaims: 'crmPages.reclaimsTitle',
    incidents: 'crmPages.incidentsTitle',
    whatsapp: 'crm.whatsappJournal',
    emails: 'crm.emailJournal',
    sms: 'crm.smsJournal',
    'contact-logs': 'crm.contactLogs',
    interests: 'crmPages.interestsTitle',
    'social-media': 'crmPages.socialMediaTitle',
    'general-crm': 'crmPages.generalCrmTitle',
    reservations: 'resDetail.reservations',
    accompanying: 'crmPages.accompanyingTitle',
    family: 'crmPages.familyTitle',
    booker: 'crmPages.bookerTitle',
    sources: 'crmPages.sourcesTitle',
    'trip-reasons': 'crmPages.tripReasonsTitle',
  };

  return (
    <GuestCrmReadOnly.Provider value={locked}>
    <EraModal
      open
      title={t(titleKey[panelId] as 'crm.tasks')}
      onClose={onClose}
      maxWidthClass="max-w-3xl"
      bodyClassName="max-h-[70vh] overflow-y-auto"
    >
      {panelId === 'tasks' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="tasksPage.title"
          apiPath={(gid) => `/api/guests/${gid}/tasks`}
          addLabelKey="tasksPage.add"
          addFields={[{ name: 'title', label: t('tasksPage.prompt'), required: true, preset: 'longText' }]}
          buildBody={(v) => ({ title: v.title.trim() })}
          searchKeys={['title', 'status']}
          renderItem={(r) => (
            <li key={String(r.id)} className="flex justify-between rounded-xl border border-[#D5DADF] p-3">
              <span>{String(r.title)}</span>
              <span className="text-[#7F8C8D]">{String(r.status)}</span>
            </li>
          )}
        />
      ) : null}
      {panelId === 'notes' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="notesPage.title"
          apiPath={(gid) => `/api/guests/${gid}/notes`}
          addLabelKey="notesPage.add"
          addFields={[{ name: 'text', label: t('notesPage.prompt'), required: true, multiline: true }]}
          buildBody={(v) => ({ text: v.text.trim() })}
          searchKeys={['text', 'noteType']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              <p className="whitespace-pre-wrap">{String(r.text)}</p>
            </li>
          )}
        />
      ) : null}
      {panelId === 'tags' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.tagsTitle"
          addLabelKey="crmPages.addTag"
          apiPath={(gid) => `/api/guests/${gid}/tags`}
          addFields={[{ name: 'name', label: t('crmPages.tagPrompt'), required: true, preset: 'shortText' }]}
          buildBody={(v) => ({ name: v.name.trim() })}
          searchKeys={['name']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-full bg-[#EBF5FB] px-3 py-1 text-[#2980B9]">
              {String(r.name)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'preferences' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.preferencesTitle"
          apiPath={(gid) => `/api/guests/${gid}/preferences`}
          addFields={[
            { name: 'preference', label: t('crmFields.preference'), required: true, preset: 'longText' },
            { name: 'importance', label: t('crmFields.importance'), defaultValue: 'HIGH', preset: 'shortText' },
            { name: 'note', label: t('crmFields.note'), multiline: true },
          ]}
          buildBody={(v) => ({
            preference: v.preference.trim(),
            importance: v.importance.trim() || 'HIGH',
            note: v.note.trim() || undefined,
          })}
          searchKeys={['preference', 'importance', 'note']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              <strong>{String(r.preference)}</strong>
              {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
            </li>
          )}
        />
      ) : null}
      {panelId === 'allergens' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.allergensTitle"
          apiPath={(gid) => `/api/guests/${gid}/allergens`}
          addFields={[
            { name: 'allergen', label: t('crmFields.allergen'), required: true, preset: 'longText' },
            { name: 'note', label: t('crmFields.note'), multiline: true },
          ]}
          buildBody={(v) => ({ allergen: v.allergen.trim(), note: v.note.trim() || undefined })}
          searchKeys={['allergen', 'note']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <strong>{String(r.allergen)}</strong>
            </li>
          )}
        />
      ) : null}
      {panelId === 'special-dates' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.specialDatesTitle"
          apiPath={(gid) => `/api/guests/${gid}/special-dates`}
          addFields={[
            { name: 'dateType', label: t('crmFields.dateType'), required: true, preset: 'shortText' },
            { name: 'eventDate', label: t('crmFields.eventDate'), required: true, preset: 'date' },
          ]}
          buildBody={(v) => ({ dateType: v.dateType.trim(), eventDate: v.eventDate.trim() })}
          searchKeys={['dateType', 'eventDate']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.dateType)} — {String(r.eventDate).slice(0, 10)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'special-notes' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.specialNotesTitle"
          apiPath={(gid) => `/api/guests/${gid}/special-notes`}
          addFields={[{ name: 'text', label: t('crmFields.specialNote'), required: true, multiline: true }]}
          buildBody={(v) => ({ text: v.text.trim() })}
          searchKeys={['text']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.text)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'favorites' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.favoritesTitle"
          apiPath={(gid) => `/api/guests/${gid}/favorites`}
          addFields={[
            { name: 'roomNumber', label: t('crmFields.roomNumber'), required: true, preset: 'code' },
            { name: 'roomType', label: t('crmFields.roomType'), preset: 'shortText' },
          ]}
          buildBody={(v) => ({ roomNumber: v.roomNumber.trim(), roomType: v.roomType.trim() || undefined })}
          searchKeys={['roomNumber', 'roomType']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.roomNumber)} {r.roomType ? `· ${String(r.roomType)}` : ''}
            </li>
          )}
        />
      ) : null}
      {panelId === 'comments' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.commentsTitle"
          apiPath={(gid) => `/api/guests/${gid}/comments`}
          addFields={[{ name: 'comment', label: t('crmFields.comment'), required: true, multiline: true }]}
          buildBody={(v) => ({ comment: v.comment.trim() })}
          searchKeys={['comment']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.comment)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'surveys' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.surveysTitle"
          apiPath={(gid) => `/api/guests/${gid}/surveys`}
          addFields={[
            { name: 'surveyName', label: t('crmFields.surveyName'), required: true, preset: 'longText' },
            { name: 'filledAt', label: t('crmFields.eventDate'), preset: 'date' },
          ]}
          buildBody={(v) => ({ surveyName: v.surveyName.trim(), filledAt: v.filledAt.trim() || undefined })}
          searchKeys={['surveyName']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.surveyName)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'reclaims' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.reclaimsTitle"
          apiPath={(gid) => `/api/guests/${gid}/reclaims`}
          addFields={[{ name: 'comment', label: t('crmFields.reclaim'), required: true, multiline: true }]}
          buildBody={(v) => ({ comment: v.comment.trim() })}
          searchKeys={['comment']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.comment)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'incidents' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crmPages.incidentsTitle"
          apiPath={(gid) => `/api/guests/${gid}/incidents`}
          addFields={[
            { name: 'location', label: t('crmFields.location'), required: true, preset: 'longText' },
            { name: 'description', label: t('crmFields.description'), required: true, multiline: true },
          ]}
          buildBody={(v) => ({ location: v.location.trim(), description: v.description.trim() })}
          searchKeys={['location', 'description']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              <strong>{String(r.location)}</strong>
              <p className="mt-1">{String(r.description)}</p>
            </li>
          )}
        />
      ) : null}
      {panelId === 'whatsapp' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crm.whatsappJournal"
          apiPath={(gid) => `/api/guests/${gid}/communications?channel=WHATSAPP`}
          postPath={(gid) => `/api/guests/${gid}/communications`}
          addFields={[{ name: 'body', label: t('crmFields.message'), required: true, multiline: true }]}
          buildBody={(v) => ({ channel: 'WHATSAPP', body: v.body.trim() })}
          searchKeys={['body', 'status']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.body)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'emails' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crm.emailJournal"
          apiPath={(gid) => `/api/guests/${gid}/communications?channel=EMAIL`}
          postPath={(gid) => `/api/guests/${gid}/communications`}
          addFields={[
            { name: 'subject', label: t('crmFields.subject'), preset: 'longText' },
            { name: 'body', label: t('crmFields.message'), required: true, multiline: true },
          ]}
          buildBody={(v) => ({ channel: 'EMAIL', subject: v.subject.trim(), body: v.body.trim() })}
          searchKeys={['subject', 'body']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {r.subject ? <strong>{String(r.subject)}</strong> : null}
              <p className="mt-1">{String(r.body)}</p>
            </li>
          )}
        />
      ) : null}
      {panelId === 'sms' ? (
        <GuestCrmPromptListPage
          embedded
          guestId={guestId}
          titleKey="crm.smsJournal"
          apiPath={(gid) => `/api/guests/${gid}/communications?channel=SMS`}
          postPath={(gid) => `/api/guests/${gid}/communications`}
          addFields={[{ name: 'body', label: t('crmFields.message'), required: true, multiline: true }]}
          buildBody={(v) => ({ channel: 'SMS', body: v.body.trim() })}
          searchKeys={['body']}
          renderItem={(r) => (
            <li key={String(r.id)} className="rounded-xl border border-[#D5DADF] p-3">
              {String(r.body)}
            </li>
          )}
        />
      ) : null}
      {panelId === 'family' ? <FamilyPanel guestId={guestId} onOpenGuest={onOpenGuest} /> : null}
      {panelId === 'interests' ? (
        <GuestCrmExtensionPage embedded guestId={guestId} titleKey="crmPages.interestsTitle" field="interests" />
      ) : null}
      {panelId === 'social-media' ? (
        <GuestCrmExtensionPage embedded guestId={guestId} titleKey="crmPages.socialMediaTitle" field="socialMedia" socialMode />
      ) : null}
      {panelId === 'general-crm' ? (
        <GuestCrmExtensionPage embedded guestId={guestId} titleKey="crmPages.generalCrmTitle" field="generalCrmNotes" multiline />
      ) : null}
      {panelId === 'archive' ? <ArchivePanel guestId={guestId} /> : null}
      {panelId === 'contact-logs' ? (
        <ReadList
          guestId={guestId}
          path="/api/guests/{id}/contact-logs"
          line={(r) => `${String(r.channel ?? '')} · ${String(r.contactDate ?? '').slice(0, 10)}`}
        />
      ) : null}
      {panelId === 'accompanying' ? (
        <ReadList
          guestId={guestId}
          path="/api/guests/{id}/accompanying"
          line={(r) => `${String(r.firstName ?? '')} ${String(r.lastName ?? '')}`.trim()}
          onOpen={(r) => {
            const linked = r.guestId ? String(r.guestId) : '';
            if (linked) onOpenGuest?.(linked);
            else if (r.reservationId) onOpenReservation?.(String(r.reservationId));
          }}
        />
      ) : null}
      {panelId === 'booker' ? (
        <ReadList
          guestId={guestId}
          path="/api/guests/{id}/booker-history"
          line={(r) => {
            const guest = r.guest as { fullName?: string } | undefined;
            return `${guest?.fullName ?? ''} · ${String(r.checkInDate ?? '').slice(0, 10)}`;
          }}
          onOpen={(r) => onOpenReservation?.(String(r.id))}
        />
      ) : null}
      {panelId === 'sources' ? (
        <AnalyticsList
          guestId={guestId}
          field="sources"
          line={(r) => `${String(r.sourceName ?? r.resSource ?? '')} · ${String(r.roomCount ?? '')}`}
        />
      ) : null}
      {panelId === 'trip-reasons' ? (
        <AnalyticsList
          guestId={guestId}
          field="tripReasons"
          line={(r) => `${String(r.tripReason ?? '')} · ${String(r.resCount ?? '')}`}
        />
      ) : null}
      {panelId === 'reservations' ? (
        <ReservationList guestId={guestId} onOpen={(id) => onOpenReservation?.(id)} />
      ) : null}
    </EraModal>
    </GuestCrmReadOnly.Provider>
  );
}
