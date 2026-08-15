const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');

function fix(rel, fn) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  s = fn(s);
  if (s === before) console.warn('no change?', rel);
  fs.writeFileSync(p, s.replace(/\r\n/g, '\n'), 'utf8');
  console.log('fixed', rel);
}

fix('app/transfers/page.tsx', (s) => {
  const pairs = [
    [
      `    if (!reservationId || !pickupAt || !price) {
      setMsg(t('missingFields'));
      return;
    }`,
      `    if (!reservationId || !pickupAt || !price) {
      showApiError({ error: t('missingFields') });
      return;
    }`,
    ],
    [
      `    setMsg(res.ok ? t('booked') : data.error ?? tc('error'));
    if (res.ok) {
      setModalOpen(false);
      await load();
    }`,
      `    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('booked'));
    setModalOpen(false);
    await load();`,
    ],
    [
      `    if (!vehicleId) {
      setMsg(t('selectVehicle'));
      return;
    }`,
      `    if (!vehicleId) {
      showApiError({ error: t('selectVehicle') });
      return;
    }`,
    ],
    [
      `    setMsg(res.ok ? t('assigned') : data.error ?? tc('error'));
    if (res.ok) await load();`,
      `    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('assigned'));
    await load();`,
    ],
    [
      `    setMsg(res.ok ? t('completed') : data.error ?? tc('error'));
    if (res.ok) await load();`,
      `    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('completed'));
    await load();`,
    ],
  ];
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('transfers missing block: ' + a.slice(0, 60));
    s = s.split(a).join(b);
  }
  return s;
});

fix('app/banquets/page.tsx', (s) => {
  const pairs = [
    [
      `    if (!eventName || !saloonId || !eventDate || !pax) {
      setMsg(t('missingFields'));
      return;
    }`,
      `    if (!eventName || !saloonId || !eventDate || !pax) {
      showApiError({ error: t('missingFields') });
      return;
    }`,
    ],
    [
      `    setMsg(res.ok ? t('created') : data.error ?? tc('error'));
    if (res.ok) {
      setModalOpen(false);
      setEventName('');
      await load();
    }`,
      `    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('created'));
    setModalOpen(false);
    setEventName('');
    await load();`,
    ],
    [
      `    setMsg(res.ok ? t('confirmed') : data.error ?? tc('error'));
    if (res.ok) await load();`,
      `    if (!res.ok) {
      showApiError(data, tc('error'));
      return;
    }
    showSuccess(t('confirmed'));
    await load();`,
    ],
    [
      `            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t('eventDate')}</label>
              <input
                type="date"
                className={MODAL_INPUT_CLASS}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>`,
      `            <DatePicker
              label={t('eventDate')}
              value={eventDate}
              onChange={setEventDate}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
              required
            />`,
    ],
  ];
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('banquets missing block: ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  return s;
});

fix('app/channel/page.tsx', (s) => {
  // ensure showSuccess imported
  if (!s.includes('showSuccess')) {
    s = s.replace('showApiError,', 'showApiError,\n  showSuccess,');
    if (!s.includes('showSuccess')) {
      s = s.replace('showApiError\n', 'showApiError,\n  showSuccess\n');
    }
  }

  const ternaryKeys = [
    ['channelCreated', 'if (res.ok) {\n      setAddChannelModalOpen(false);\n      setChannelCode(\'\');\n      setChannelName(\'\');\n    }'],
    ['roomMappingSaved', 'if (res.ok) {\n      setMapRoomModalOpen(false);\n      setMapRoomTypeId(\'\');\n      setOtaRoomCode(\'\');\n    }'],
    ['rateMappingSaved', 'if (res.ok) {\n      setMapRateModalOpen(false);\n      setMapRatePlanId(\'\');\n      setOtaRateCode(\'\');\n    }'],
    ['errorLogged', 'if (res.ok) {\n      setLogErrorModalOpen(false);\n      setOtaRef(\'\');\n    }'],
    ['salesClosed', 'if (res.ok) {\n      setStopSellModalOpen(false);\n      setStopDate(\'\');\n      setStopRoomTypeId(\'\');\n    }'],
  ];

  for (const [key] of ternaryKeys) {
    const a = `setMsg(res.ok ? t('${key}') : data.error);`;
    const b = `if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('${key}'));`;
    if (!s.includes(a)) throw new Error('channel missing ' + a);
    s = s.split(a).join(b);
  }

  s = s.split(`setMsg(res.ok ? t('resolved') : data.error);`).join(
    `if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('resolved'));`,
  );
  s = s.split(`setMsg(res.ok ? t('stopSellRemoved') : data.error);`).join(
    `if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('stopSellRemoved'));`,
  );

  s = s.split(
    `setMsg(t('pushSuccess', { adapter: data.adapter ?? '—', rows: data.rowCount ?? 0 }));`,
  ).join(`showSuccess(t('pushSuccess', { adapter: data.adapter ?? '—', rows: data.rowCount ?? 0 }));`);

  s = s.split(`setMsg(
        t('pullSuccess', {
          pulled: data.pulled ?? 0,
          created: data.created ?? 0,
          updated: data.updated ?? 0,
          cancelled: data.cancelled ?? 0,
        }),
      );`).join(`showSuccess(
        t('pullSuccess', {
          pulled: data.pulled ?? 0,
          created: data.created ?? 0,
          updated: data.updated ?? 0,
          cancelled: data.cancelled ?? 0,
        }),
      );`);

  // remove avail date inputs block
  s = s.split(
    `        <div className="mb-2 flex gap-2">
          <input type="date" className="rounded border px-2 py-1 text-[13px]" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} />
          <input type="date" className="rounded border px-2 py-1 text-[13px]" value={availTo} onChange={(e) => setAvailTo(e.target.value)} />
        </div>
`,
  ).join('');

  s = s.split(
    `          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stop-date">
              {tc('date')}
            </label>
            <input
              id="stop-date"
              type="date"
              required
              className={MODAL_INPUT_CLASS}
              value={stopDate}
              onChange={(e) => setStopDate(e.target.value)}
            />
          </div>`,
  ).join(
    `          <DatePicker
            label={tc('date')}
            value={stopDate}
            onChange={setStopDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
            required
          />`,
  );

  if (/\bsetMsg\b/.test(s)) {
    for (const line of s.split('\n')) if (line.includes('setMsg')) console.log(line);
    throw new Error('channel still setMsg');
  }
  if (s.includes('type="date"')) {
    console.log('remaining date inputs');
    throw new Error('channel still type=date');
  }
  return s;
});

console.log('remainders done');
