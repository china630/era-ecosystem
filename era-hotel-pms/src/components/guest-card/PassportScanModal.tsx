'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraModal } from '@/components/EraModal';
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { guestComposedFullName } from '@/lib/guest-identity.shared';
import { mapNationalityToIso } from '@/lib/person-documents';
import {
  clientPointInBox,
  cropRectFromPoints,
  isUsableCrop,
  MRZ_CROP_ANGLE_MAX,
  MRZ_CROP_ANGLE_MIN,
  withCropAngle,
  type CropRect,
} from '@/lib/mrz/crop-rect';
import { isPdfFile, isSupportedScanFile, rasterizePdfFirstPage } from '@/lib/mrz/pdf-page';
import { orientCropForOcr, sampleRotatedCrop } from '@/lib/mrz/sample-rotated-crop';

type Parsed = {
  lastName: string;
  firstName: string;
  middleName: string;
  nameFieldRaw?: string;
  nationality: string;
  issuingCountry: string;
  documentNumber: string;
  birthDate: string;
  expiryDate: string;
  sex: string;
  checksOk: boolean;
};

type Hit = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  passportNo: string | null;
  expiresAt: string | null;
};

type Match =
  | { kind: 'none' }
  | { kind: 'mrz'; guest: Hit }
  | { kind: 'passport'; guest: Hit; nameClash: boolean }
  | { kind: 'identity'; guests: Hit[]; expiry: 'newer' | 'older' | 'unknown' }
  | { kind: 'similar'; guests: Hit[]; reason: 'typo' | 'metaphone' | 'translit' }
  | { kind: 'list'; guests: Hit[] };

export type PassportScanDone = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
};

export function PassportScanModal({
  open,
  currentGuestId,
  onClose,
  onDone,
}: {
  open: boolean;
  currentGuestId?: string | null;
  onClose: () => void;
  onDone: (guest: PassportScanDone) => void;
}) {
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropBoxRef = useRef<HTMLDivElement | null>(null);
  const srcRef = useRef<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [drag, setDrag] = useState<CropRect | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [currentSnap, setCurrentSnap] = useState<Hit | null>(null);
  const [busy, setBusy] = useState(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const drawingCleanup = useRef<(() => void) | null>(null);

  function stopCropDraw() {
    drawingCleanup.current?.();
    drawingCleanup.current = null;
    origin.current = null;
  }

  function revokeSrc() {
    if (srcRef.current) {
      URL.revokeObjectURL(srcRef.current);
      srcRef.current = null;
    }
  }

  function replaceSrc(next: string | null) {
    stopCropDraw();
    revokeSrc();
    srcRef.current = next;
    setSrc(next);
    setImageReady(false);
    setDrag(null);
  }

  function reset() {
    stopCropDraw();
    revokeSrc();
    setSrc(null);
    setImageReady(false);
    setDrag(null);
    setParsed(null);
    setMatch(null);
    setCurrentSnap(null);
  }

  function beginCropDraw(start: { x: number; y: number }) {
    stopCropDraw();
    origin.current = start;
    setDrag({ x: start.x, y: start.y, w: 0, h: 0, angleDeg: 0 });
    function onMove(e: PointerEvent) {
      if (!origin.current || !cropBoxRef.current) return;
      const box = cropBoxRef.current.getBoundingClientRect();
      setDrag(cropRectFromPoints(origin.current, clientPointInBox(e.clientX, e.clientY, box), 0));
    }
    function onUp() {
      stopCropDraw();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    drawingCleanup.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the modal closes
  }, [open]);

  useEffect(() => () => {
    stopCropDraw();
    revokeSrc();
  }, []);

  async function loadCurrentSnap(guestId: string | null | undefined) {
    if (!guestId) {
      setCurrentSnap(null);
      return;
    }
    try {
      const [fullRes, docsRes] = await Promise.all([
        fetch(`/api/guests/${guestId}/full`),
        fetch(`/api/guests/${guestId}/documents`),
      ]);
      const fullJson = await fullRes.json().catch(() => ({}));
      const docsJson = await docsRes.json().catch(() => ([]));
      if (!fullRes.ok) {
        setCurrentSnap(null);
        return;
      }
      const guest = fullJson.guest ?? fullJson;
      const docs = Array.isArray(docsJson)
        ? docsJson
        : Array.isArray(docsJson.items)
          ? docsJson.items
          : Array.isArray(docsJson.data)
            ? docsJson.data
            : [];
      const pass = docs.find(
        (row: { docType?: string; docNumber?: string }) =>
          String(row.docType ?? '').toUpperCase() === 'PASSPORT' && row.docNumber,
      );
      setCurrentSnap({
        id: guestId,
        firstName: guest.firstName ?? null,
        lastName: guest.lastName ?? null,
        birthDate: guest.birthDate ? String(guest.birthDate).slice(0, 10) : null,
        passportNo: pass?.docNumber ?? null,
        expiresAt: pass?.expiresAt ? String(pass.expiresAt).slice(0, 10) : null,
      });
    } catch {
      setCurrentSnap(null);
    }
  }

  function close() {
    reset();
    onClose();
  }

  async function loadScanFile(file: File) {
    setParsed(null);
    setMatch(null);
    if (!isSupportedScanFile(file)) {
      showApiError({ error: t('mrzFileFail') });
      replaceSrc(null);
      return;
    }
    setBusy(true);
    try {
      if (isPdfFile(file)) {
        const blob = await rasterizePdfFirstPage(file);
        replaceSrc(URL.createObjectURL(blob));
      } else {
        replaceSrc(URL.createObjectURL(file));
      }
    } catch {
      showApiError({ error: isPdfFile(file) ? t('mrzPdfFail') : t('mrzFileFail') });
      replaceSrc(null);
    } finally {
      setBusy(false);
    }
  }

  async function readCrop() {
    const image = imgRef.current;
    if (!image || !imageReady || !image.naturalWidth || !image.clientWidth || !isUsableCrop(drag)) return;
    setBusy(true);
    try {
      const scaleX = image.naturalWidth / image.clientWidth;
      const scaleY = image.naturalHeight / image.clientHeight;
      const sample = sampleRotatedCrop(image, drag, scaleX, scaleY);
      const canvases = orientCropForOcr(sample, drag);
      let best: { text: string; parsed: Parsed | null } | null = null;
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<' });
      for (const canvas of canvases) {
        const { data } = await worker.recognize(canvas);
        const res = await fetch('/api/guests/mrz-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.text, currentGuestId: currentGuestId ?? null }),
        });
        const json = await res.json();
        if (!res.ok) {
          showApiError(json);
          await worker.terminate();
          return;
        }
        const next = json.parsed as Parsed | null;
        if (next?.checksOk) {
          best = { text: data.text, parsed: next };
          setMatch(json.match as Match);
          break;
        }
        if (!best) best = { text: data.text, parsed: next };
        setMatch(json.match as Match);
      }
      await worker.terminate();
      setParsed(best?.parsed ?? null);
      if (best?.parsed) await loadCurrentSnap(currentGuestId);
      if (!best?.parsed) showApiError({ error: t('mrzNone') });
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : t('mrzNone') });
    } finally {
      setBusy(false);
    }
  }

  async function writeGuest(mode: 'create' | 'replace', guestId?: string) {
    if (!parsed) return;
    setBusy(true);
    try {
      const nationality =
        mapNationalityToIso(parsed.nationality) || mapNationalityToIso(parsed.issuingCountry);
      if (!nationality) {
        showApiError({ error: t('mrzCountry') });
        setBusy(false);
        return;
      }
      const fullName = guestComposedFullName({
        firstName: parsed.firstName,
        middleName: parsed.middleName,
        lastName: parsed.lastName,
      });
      const body = {
        fullName,
        firstName: parsed.firstName,
        middleName: parsed.middleName || null,
        lastName: parsed.lastName,
        sex: parsed.sex || null,
        birthDate: parsed.birthDate || null,
        nationality,
        passportNumber: parsed.documentNumber,
      };
      const url = mode === 'create' ? '/api/guests' : `/api/guests/${guestId}/full`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json);
        return;
      }
      const id = mode === 'create' ? String(json.id) : guestId!;
      const older =
        match?.kind === 'identity' && match.expiry === 'older';
      await fetch(`/api/guests/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: 'PASSPORT',
          docNumber: parsed.documentNumber,
          nationality,
          isPrimary: !older,
          expiresAt: parsed.expiryDate || undefined,
          mrzNameField: parsed.nameFieldRaw || null,
        }),
      });
      showSuccess(t('mrzSaved'));
      onDone({
        id,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        birthDate: parsed.birthDate || undefined,
      });
      close();
    } finally {
      setBusy(false);
    }
  }

  function setField(key: keyof Parsed, value: string) {
    setParsed((row) => (row ? { ...row, [key]: value } : row));
  }

  const fields = parsed ? (
    parsed.checksOk ? (
      <ul className="m-0 list-none space-y-1 text-[13px]">
        <li>{parsed.lastName} {parsed.firstName} {parsed.middleName}</li>
        <li>{parsed.nationality} · {parsed.documentNumber}</li>
        <li>{parsed.birthDate} · {parsed.sex} · {parsed.expiryDate}</li>
      </ul>
    ) : (
      <div className="grid gap-2 text-[13px]">
        <p className="m-0 text-red-700">{t('mrzBadCheck')}</p>
        <label className="flex flex-col gap-1">{t('mrzLast')}
          <input className="rounded border px-2 py-1" value={parsed.lastName} onChange={(e) => setField('lastName', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">{t('mrzFirst')}
          <input className="rounded border px-2 py-1" value={parsed.firstName} onChange={(e) => setField('firstName', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">{t('mrzNumber')}
          <input className="rounded border px-2 py-1" value={parsed.documentNumber} onChange={(e) => setField('documentNumber', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">{t('mrzBirth')}
          <input className="rounded border px-2 py-1" value={parsed.birthDate} onChange={(e) => setField('birthDate', e.target.value)} />
        </label>
      </div>
    )
  ) : null;

  return (
    <EraModal open={open} title={t('mrzTitle')} onClose={close} maxWidthClass="max-w-3xl">
      {!parsed ? (
        <div className="space-y-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void loadScanFile(file);
            }}
          />
          {src ? (
            <div
              ref={cropBoxRef}
              className="relative inline-block max-w-full cursor-crosshair touch-none select-none"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.preventDefault();
                const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                beginCropDraw(clientPointInBox(e.clientX, e.clientY, box));
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onLoad={() => setImageReady(true)}
                onError={() => {
                  setImageReady(false);
                  showApiError({ error: t('mrzFileFail') });
                  replaceSrc(null);
                }}
                className="pointer-events-none max-h-[480px] max-w-full select-none"
              />
              {drag ? (
                <div
                  className="pointer-events-none absolute border-2 border-[#2980B9] bg-[#2980B9]/15"
                  style={{
                    left: drag.x,
                    top: drag.y,
                    width: drag.w,
                    height: drag.h,
                    transform: `rotate(${drag.angleDeg}deg)`,
                    transformOrigin: 'center center',
                  }}
                />
              ) : null}
            </div>
          ) : null}
          <p className="text-[13px] text-[#7F8C8D]">{t('mrzHint')}</p>
          {isUsableCrop(drag) ? (
            <label className="flex flex-col gap-1 text-[13px] text-[#2C3E50]">
              {t('mrzAngle', { deg: drag.angleDeg })}
              <input
                type="range"
                min={MRZ_CROP_ANGLE_MIN}
                max={MRZ_CROP_ANGLE_MAX}
                step={1}
                value={drag.angleDeg}
                disabled={busy}
                onChange={(e) => setDrag(withCropAngle(drag, Number(e.target.value)))}
              />
            </label>
          ) : null}
          {!isUsableCrop(drag) && drag ? (
            <p className="text-[13px] text-[#B9770E]">{t('mrzCropSmall')}</p>
          ) : null}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !imageReady || !isUsableCrop(drag)}
            onClick={() => void readCrop()}
          >
            {t('mrzRead')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentSnap ? (
            <div className="grid gap-2 rounded border border-[#ECEFF1] p-3 text-[13px] md:grid-cols-2">
              <div>
                <p className="m-0 font-semibold text-[#7F8C8D]">{t('mrzAsWas')}</p>
                <p className="m-0">
                  {currentSnap.lastName} {currentSnap.firstName}
                </p>
                <p className="m-0">
                  {currentSnap.passportNo ?? '—'} · {currentSnap.birthDate ?? '—'}
                </p>
              </div>
              <div>
                <p className="m-0 font-semibold text-[#7F8C8D]">{t('mrzFromScan')}</p>
              </div>
            </div>
          ) : null}
          {fields}
          {match?.kind === 'passport' && match.nameClash ? (
            <p className="text-[13px] text-red-700">{t('mrzNameClash')}</p>
          ) : null}
          {match?.kind === 'mrz' ? (
            <p className="text-[13px]">
              {t('mrzExists')} {match.guest.lastName} {match.guest.firstName} · {t('mrzRawHit')}
            </p>
          ) : null}
          {match?.kind === 'passport' ? (
            <p className="text-[13px]">
              {t('mrzExists')} {match.guest.lastName} {match.guest.firstName} · {match.guest.passportNo}
            </p>
          ) : null}
          {match?.kind === 'identity' ? (
            <p className="text-[13px]">
              {t('mrzExists')} {match.guests[0]?.lastName} {match.guests[0]?.firstName}
              {match.expiry === 'older' ? ` · ${t('mrzOlderBook')}` : ` · ${t('mrzNewBook')}`}
            </p>
          ) : null}
          {match?.kind === 'similar' ? (
            <p className="text-[13px] text-[#B9770E]">
              {t('mrzSimilar')} ({t(`mrzSimilarReason.${match.reason}`)})
            </p>
          ) : null}
          {match?.kind === 'list' || match?.kind === 'similar'
            ? match.guests.map((guest) => (
                <button
                  key={guest.id}
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    onDone({
                      id: guest.id,
                      firstName: guest.firstName ?? '',
                      lastName: guest.lastName ?? '',
                      birthDate: guest.birthDate ?? undefined,
                    });
                    close();
                  }}
                >
                  {guest.lastName} {guest.firstName}
                </button>
              ))
            : null}
          <div className="flex flex-wrap gap-2">
            {match?.kind === 'passport' || match?.kind === 'identity' || match?.kind === 'mrz' ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => {
                  const guest =
                    match.kind === 'passport' || match.kind === 'mrz'
                      ? match.guest
                      : match.guests[0]!;
                  if (match.kind === 'passport' || match.kind === 'mrz') {
                    onDone({
                      id: guest.id,
                      firstName: guest.firstName ?? parsed.firstName,
                      lastName: guest.lastName ?? parsed.lastName,
                      birthDate: guest.birthDate ?? parsed.birthDate,
                    });
                    close();
                    return;
                  }
                  if (match.kind === 'identity' && match.expiry !== 'older') {
                    void writeGuest('replace', guest.id);
                    return;
                  }
                  onDone({
                    id: guest.id,
                    firstName: guest.firstName ?? '',
                    lastName: guest.lastName ?? '',
                    birthDate: guest.birthDate ?? undefined,
                  });
                  close();
                }}
              >
                {t('mrzConfirm')}
              </button>
            ) : null}
            {match?.kind === 'none' || match?.kind === 'similar' || !parsed.checksOk ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void writeGuest(currentGuestId ? 'replace' : 'create', currentGuestId ?? undefined)}>
                {currentGuestId ? t('mrzReplace') : t('mrzCreate')}
              </button>
            ) : null}
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setParsed(null)}>
              {tc('back')}
            </button>
          </div>
        </div>
      )}
    </EraModal>
  );
}
