const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

function writeUtf8(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = content.replace(/\r\n/g, '\n');
  fs.writeFileSync(p, data, 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16: ' + p);
  console.log('ok', rel);
}

const pages = {
  'app/guests/[id]/preferences/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.preferencesTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/preferences\`}
      addFields={[
        { name: 'preference', label: 'Preference', required: true, preset: 'longText' },
        { name: 'importance', label: 'Importance', defaultValue: 'HIGH', preset: 'shortText' },
        { name: 'note', label: 'Note', multiline: true },
      ]}
      buildBody={(v) => ({
        preference: v.preference.trim(),
        importance: v.importance.trim() || 'HIGH',
        note: v.note.trim() || undefined,
      })}
      searchKeys={['preference', 'importance', 'note']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.preference)}</strong>
          {r.importance ? <span className="text-[#7F8C8D]"> — {String(r.importance)}</span> : null}
          {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/allergens/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.allergensTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/allergens\`}
      addFields={[
        { name: 'allergen', label: 'Allergen', required: true, preset: 'longText' },
        { name: 'note', label: 'Note', multiline: true },
      ]}
      buildBody={(v) => ({
        allergen: v.allergen.trim(),
        note: v.note.trim() || undefined,
      })}
      searchKeys={['allergen', 'note']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <strong>{String(r.allergen)}</strong>
          {r.note ? <p className="mt-1">{String(r.note)}</p> : null}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/special-dates/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.specialDatesTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/special-dates\`}
      addFields={[
        { name: 'dateType', label: 'Date type', required: true, preset: 'shortText', placeholder: 'Anniversary, Birthday…' },
        { name: 'eventDate', label: 'Date', required: true, preset: 'date', placeholder: 'YYYY-MM-DD' },
      ]}
      buildBody={(v) => ({
        dateType: v.dateType.trim(),
        eventDate: v.eventDate.trim(),
      })}
      searchKeys={['dateType', 'eventDate']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.dateType)} — {String(r.eventDate).slice(0, 10)}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/special-notes/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.specialNotesTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/special-notes\`}
      addFields={[
        { name: 'text', label: 'Special note', required: true, multiline: true, placeholder: 'Min 5 characters' },
      ]}
      buildBody={(v) => ({ text: v.text.trim() })}
      searchKeys={['text']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-rose-300 bg-rose-50/80 p-3 text-rose-900">
          {String(r.text)}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/favorites/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.favoritesTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/favorites\`}
      addFields={[
        { name: 'roomNumber', label: 'Room number', required: true, preset: 'code' },
        { name: 'roomType', label: 'Room type', preset: 'shortText' },
      ]}
      buildBody={(v) => ({
        roomNumber: v.roomNumber.trim(),
        roomType: v.roomType.trim() || undefined,
      })}
      searchKeys={['roomNumber', 'roomType']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          Room {String(r.roomNumber)}
          {r.roomType ? <span className="text-[#7F8C8D]"> ({String(r.roomType)})</span> : null}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/comments/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.commentsTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/comments\`}
      addFields={[
        { name: 'comment', label: 'Comment', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ comment: v.comment.trim(), state: 'NEW' })}
      searchKeys={['comment', 'state']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.state)}</span>
          <p className="mt-1">{String(r.comment)}</p>
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/surveys/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.surveysTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/surveys\`}
      addFields={[
        { name: 'surveyName', label: 'Survey name', required: true, preset: 'longText' },
        {
          name: 'filledAt',
          label: 'Filled at',
          required: true,
          preset: 'date',
          defaultValue: new Date().toISOString().slice(0, 10),
        },
      ]}
      buildBody={(v) => ({
        surveyName: v.surveyName.trim(),
        filledAt: v.filledAt.trim(),
      })}
      searchKeys={['surveyName', 'filledAt']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.surveyName)} — {String(r.filledAt).slice(0, 10)}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/reclaims/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.reclaimsTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/reclaims\`}
      addFields={[
        { name: 'comment', label: 'Reclaim comment', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ comment: v.comment.trim() })}
      searchKeys={['comment']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          {String(r.comment)}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/incidents/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.incidentsTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/incidents\`}
      addFields={[
        { name: 'location', label: 'Location', required: true, preset: 'longText' },
        { name: 'description', label: 'Description', required: true, multiline: true },
      ]}
      buildBody={(v) => ({
        location: v.location.trim(),
        description: v.description.trim(),
      })}
      searchKeys={['location', 'description']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.location)}</strong>
          <p className="mt-1">{String(r.description)}</p>
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/emails/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.sendEmail"
      apiPath={(gid) => \`/api/guests/\${gid}/communications?channel=EMAIL\`}
      postPath={(gid) => \`/api/guests/\${gid}/communications\`}
      addFields={[
        { name: 'subject', label: 'Subject', preset: 'longText' },
        { name: 'body', label: 'Email body', required: true, multiline: true },
      ]}
      buildBody={(v) => ({
        channel: 'EMAIL',
        subject: v.subject.trim(),
        body: v.body.trim(),
      })}
      searchKeys={['subject', 'body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {r.subject ? <strong>{String(r.subject)}</strong> : null}
          <p className="mt-1">{String(r.body)}</p>
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/sms/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.sendSms"
      apiPath={(gid) => \`/api/guests/\${gid}/communications?channel=SMS\`}
      postPath={(gid) => \`/api/guests/\${gid}/communications\`}
      addFields={[
        { name: 'body', label: 'SMS text', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ channel: 'SMS', body: v.body.trim() })}
      searchKeys={['body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          {String(r.body)}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/whatsapp/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crm.whatsapp"
      apiPath={(gid) => \`/api/guests/\${gid}/communications?channel=WHATSAPP\`}
      postPath={(gid) => \`/api/guests/\${gid}/communications\`}
      addFields={[
        { name: 'body', label: 'Message', required: true, multiline: true },
      ]}
      buildBody={(v) => ({ channel: 'WHATSAPP', body: v.body.trim() })}
      searchKeys={['body', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.status)}</span>
          <p className="mt-1">{String(r.body)}</p>
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/family/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.familyTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/family\`}
      addFields={[
        { name: 'relatedGuestId', label: 'Related guest UUID', required: true, preset: 'longText' },
        { name: 'relationship', label: 'Relationship', required: true, preset: 'shortText', placeholder: 'Spouse, Child…' },
      ]}
      buildBody={(v) => ({
        relatedGuestId: v.relatedGuestId.trim(),
        relationship: v.relationship.trim(),
      })}
      searchKeys={['relatedGuestId', 'relationship']}
      renderItem={(r) => {
        const rel = r.relatedGuest as { fullName?: string } | undefined;
        return (
          <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
            {rel?.fullName ?? String(r.relatedGuestId)} — {String(r.relationship)}
          </li>
        );
      }}
    />
  );
}
`,

  'app/guests/[id]/membership-agreements/page.tsx': `'use client';

import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function Page() {
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.membershipTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/time-shares\`}
      addFields={[
        { name: 'contractNo', label: 'Contract number', required: true, preset: 'code' },
        { name: 'status', label: 'Status', defaultValue: 'ACTIVE', preset: 'shortText' },
      ]}
      buildBody={(v) => ({
        contractNo: v.contractNo.trim(),
        status: v.status.trim() || 'ACTIVE',
      })}
      searchKeys={['contractNo', 'unitCode', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <strong>{String(r.contractNo)}</strong>
          {r.unitCode ? <span className="text-[#7F8C8D]"> — {String(r.unitCode)}</span> : null}
          <span className="ml-2 text-[#2980B9]">{String(r.status)}</span>
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/notes/page.tsx': `'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function GuestNotesPage() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="notesPage.title"
      apiPath={(gid) => \`/api/guests/\${gid}/notes\`}
      addLabelKey="notesPage.add"
      addFields={[
        { name: 'text', label: t('notesPage.prompt'), required: true, multiline: true },
      ]}
      buildBody={(v) => ({ text: v.text.trim() })}
      searchKeys={['text', 'noteType']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-lg border border-[#D5DADF] p-3">
          <span className="text-[11px] text-[#7F8C8D]">{String(r.noteType)}</span>
          <p className="mt-1 whitespace-pre-wrap">{String(r.text)}</p>
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/tags/page.tsx': `'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function GuestTagsPage() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="crmPages.tagsTitle"
      apiPath={(gid) => \`/api/guests/\${gid}/tags\`}
      addLabelKey="crmPages.addTag"
      addFields={[
        { name: 'name', label: t('crmPages.tagPrompt'), required: true, preset: 'shortText' },
      ]}
      buildBody={(v) => ({ name: v.name.trim() })}
      searchKeys={['name']}
      renderItem={(r) => (
        <li key={String(r.id)} className="rounded-full bg-[#EBF5FB] px-3 py-1 text-[13px] text-[#2980B9]">
          {String(r.name)}
        </li>
      )}
    />
  );
}
`,

  'app/guests/[id]/tasks/page.tsx': `'use client';

import { useTranslations } from 'next-intl';
import { GuestCrmPromptListPage } from '@/components/guest-crm/GuestCrmPromptListPage';

export default function GuestTasksPage() {
  const t = useTranslations('guestCard');
  return (
    <GuestCrmPromptListPage
      titleKey="tasksPage.title"
      apiPath={(gid) => \`/api/guests/\${gid}/tasks\`}
      addLabelKey="tasksPage.add"
      addFields={[
        { name: 'title', label: t('tasksPage.prompt'), required: true, preset: 'longText' },
      ]}
      buildBody={(v) => ({ title: v.title.trim() })}
      searchKeys={['title', 'status']}
      renderItem={(r) => (
        <li key={String(r.id)} className="flex justify-between rounded-lg border border-[#D5DADF] p-3">
          <span>{String(r.title)}</span>
          <span className="text-[#7F8C8D]">{String(r.status)}</span>
        </li>
      )}
    />
  );
}
`,
};

for (const [rel, content] of Object.entries(pages)) {
  writeUtf8(rel, content);
}

console.log('prompt consumers done', Object.keys(pages).length);
