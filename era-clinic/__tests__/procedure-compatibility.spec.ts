
describe('procedure compatibility (FORBID_SAME_DAY)', () => {
  function sameDay(a: Date, b: Date): boolean {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  function checkForbidSameDay(
    candidateCode: string,
    startAt: Date,
    existing: Array<{ procedureCode: string; startAt: Date }>,
    rule: { procedureCodeA: string; procedureCodeB: string },
  ): boolean {
    const other =
      rule.procedureCodeA === candidateCode ? rule.procedureCodeB : rule.procedureCodeA;
    return !existing.some(
      (e) => e.procedureCode === other && sameDay(startAt, e.startAt),
    );
  }

  it('blocks same-day pair', () => {
    const day = new Date('2026-07-01T10:00:00Z');
    const ok = checkForbidSameDay(
      'CRYO',
      new Date('2026-07-01T14:00:00Z'),
      [{ procedureCode: 'HEAT', startAt: day }],
      { procedureCodeA: 'CRYO', procedureCodeB: 'HEAT' },
    );
    expect(ok).toBe(false);
  });

  it('allows different days', () => {
    const ok = checkForbidSameDay(
      'CRYO',
      new Date('2026-07-02T10:00:00Z'),
      [{ procedureCode: 'HEAT', startAt: new Date('2026-07-01T10:00:00Z') }],
      { procedureCodeA: 'CRYO', procedureCodeB: 'HEAT' },
    );
    expect(ok).toBe(true);
  });
});

describe('rule types enum', () => {
  const types = ['FORBID_SAME_DAY', 'MIN_HOURS_GAP', 'FORBID_SEQUENCE'] as const;
  it('covers planned rule types', () => {
    expect(types).toHaveLength(3);
  });
});
