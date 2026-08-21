import { getReportBySlug, getPackDefaults, validatePackSlugs } from '@/lib/reports/catalog';
import { parseReportLangParam, resolveReportLocale } from '@/lib/reports/locale';
import { resolveDateMode } from '@/lib/reports/period';

function req(url: string, cookie?: string): Request {
  return new Request(url, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('hotel reports negative paths (HOT-RPT)', () => {
  describe('unknown slug', () => {
    it('returns undefined for unknown catalog slug', () => {
      expect(getReportBySlug('not-a-real-report')).toBeUndefined();
    });

    it('resolves P0 nightly pack slugs', () => {
      const pack = getPackDefaults();
      expect(pack).toHaveLength(8);
      expect(pack.map((r) => r.slug)).toEqual([
        'daily-management',
        'trial-balance-period',
        'cash-report',
        'monthly-daily-analysis',
        'in-house',
        'annual-occupancy',
        'folio-transactions',
        'department-revenues',
      ]);
    });
  });

  describe('invalid lang', () => {
    it('rejects lang query that is not az|ru|en', () => {
      const parsed = parseReportLangParam(req('http://local/api/reports/x/pdf?lang=de'));
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.message).toMatch(/Invalid lang/);
    });

    it('accepts az from query over cookie', () => {
      const parsed = parseReportLangParam(
        req('http://local/api/reports/x/pdf?lang=az', 'era_i18n_lang=en'),
      );
      expect(parsed).toEqual({ ok: true, locale: 'az' });
    });

    it('falls back to cookie then az', () => {
      expect(resolveReportLocale(req('http://local/r', 'era_i18n_lang=ru'))).toBe('ru');
      expect(resolveReportLocale(req('http://local/r'))).toBe('az');
    });
  });

  describe('PDF copy follows UI locale', () => {
    it('resolves az title not English', async () => {
      const { reportPdfT } = await import('@/lib/reports/pdf-i18n');
      const az = reportPdfT('az');
      const en = reportPdfT('en');
      expect(az('reportsPdf.cashReport')).not.toBe(en('reportsPdf.cashReport'));
      expect(az('reportsPdf.h.Department')).not.toBe(en('reportsPdf.h.Department'));
    });
  });

  describe('empty pack', () => {
    it('rejects empty enabled members', () => {
      const result = validatePackSlugs([]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/no enabled members/);
    });

    it('rejects unknown pack slug', () => {
      const result = validatePackSlugs(['daily-management', 'ghost-report']);
      expect(result.ok).toBe(false);
    });

    it('accepts Nafta default eight', () => {
      expect(validatePackSlugs(getPackDefaults().map((r) => r.slug)).ok).toBe(true);
    });
  });

  describe('empty period date modes', () => {
    it('month_to_closed starts on the 1st through business date', () => {
      const { from, to } = resolveDateMode('month_to_closed', new Date(2026, 7, 16));
      expect(from.getDate()).toBe(1);
      expect(from.getMonth()).toBe(7);
      expect(to.getDate()).toBe(16);
    });

    it('year_to_closed starts Jan 1 through business date', () => {
      const { from, to } = resolveDateMode('year_to_closed', new Date(2026, 7, 16));
      expect(from.getMonth()).toBe(0);
      expect(from.getDate()).toBe(1);
      expect(to.getMonth()).toBe(7);
    });
  });
});
