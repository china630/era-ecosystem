import type { Locale } from '@era/i18n-common';
import type PDFKit from 'pdfkit';
import azMessages from '../../../messages/az.json';
import enMessages from '../../../messages/en.json';
import ruMessages from '../../../messages/ru.json';

const MESSAGES: Record<Locale, Record<string, unknown>> = {
  az: azMessages as Record<string, unknown>,
  en: enMessages as Record<string, unknown>,
  ru: ruMessages as Record<string, unknown>,
};

function lookup(bag: unknown, path: string): string | undefined {
  let cur: unknown = bag;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function reportPdfT(locale: string): (key: string) => string {
  const bag = MESSAGES[(locale as Locale)] ?? MESSAGES.az;
  return (key: string) => lookup(bag, key) ?? key;
}

export function formatReportTimestamp(locale: string, date = new Date()): string {
  return new Intl.DateTimeFormat(locale || 'az', {
    timeZone: 'Asia/Baku',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

export function formatReportDate(locale: string, iso: string): string {
  const d = new Date(`${iso}T12:00:00+04:00`);
  return new Intl.DateTimeFormat(locale || 'az', {
    timeZone: 'Asia/Baku',
    dateStyle: 'medium',
  }).format(d);
}

const docT = new WeakMap<object, (key: string) => string>();

export function bindPdfI18n(doc: PDFKit.PDFDocument, t: (key: string) => string): void {
  docT.set(doc, t);
}

export function pdfHeaderLabel(doc: PDFKit.PDFDocument, header: string): string {
  const t = docT.get(doc);
  if (!t) return header;
  return t(`reportsPdf.h.${header}`) !== `reportsPdf.h.${header}`
    ? t(`reportsPdf.h.${header}`)
    : header;
}

export function pdfCellLabel(doc: PDFKit.PDFDocument, value: string | number): string | number {
  if (typeof value !== 'string') return value;
  const t = docT.get(doc);
  if (!t) return value;
  const mapped = t(`reportsPdf.h.${value}`);
  return mapped !== `reportsPdf.h.${value}` ? mapped : value;
}
