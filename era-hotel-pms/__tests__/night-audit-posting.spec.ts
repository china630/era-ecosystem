import { isNightAuditPosting, withNightAuditPosting } from '../src/lib/night-audit-posting';

describe('withNightAuditPosting', () => {
  it('marks only the audit call stack', async () => {
    expect(isNightAuditPosting()).toBe(false);
    await withNightAuditPosting(async () => {
      expect(isNightAuditPosting()).toBe(true);
    });
    expect(isNightAuditPosting()).toBe(false);
  });

  it('does not mark a call that started outside the audit', async () => {
    let outside = true;
    const pending = Promise.resolve().then(() => {
      outside = isNightAuditPosting();
    });
    await withNightAuditPosting(async () => {
      expect(isNightAuditPosting()).toBe(true);
      await pending;
    });
    expect(outside).toBe(false);
  });
});
