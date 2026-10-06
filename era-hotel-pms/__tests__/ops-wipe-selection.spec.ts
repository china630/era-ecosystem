import { normalizeWipeSelection, OPS_WIPE_KEYS } from '@/lib/ops-wipe-selection';

describe('normalizeWipeSelection', () => {
  it('keeps a full selection', () => {
    expect(normalizeWipeSelection([...OPS_WIPE_KEYS]).sort()).toEqual([...OPS_WIPE_KEYS].sort());
  });

  it('clears ancestors when a child is left behind', () => {
    const kept = normalizeWipeSelection(
      OPS_WIPE_KEYS.filter((key) => key !== 'labResults'),
    );
    expect(kept).not.toContain('labResults');
    expect(kept).not.toContain('medicalOrders');
    expect(kept).not.toContain('reservations');
    expect(kept).not.toContain('guests');
    expect(kept).toContain('folioCharges');
  });

  it('deletes reservations while guest notes and guests stay', () => {
    const kept = normalizeWipeSelection(OPS_WIPE_KEYS.filter((key) => key !== 'guestNotes'));
    expect(kept).toContain('reservations');
    expect(kept).toContain('folioCharges');
    expect(kept).not.toContain('guests');
    expect(kept).not.toContain('guestNotes');
  });

  it('drops a parent that was re-checked while a referencing child stays', () => {
    const kept = normalizeWipeSelection(['guests', 'reservations', 'folios', 'folioCharges']);
    expect(kept).toContain('folioCharges');
    expect(kept).not.toContain('guests');
    expect(kept).not.toContain('reservations');
    expect(kept).not.toContain('folios');
  });

  it('leaves elektraweb outbox independent', () => {
    const kept = normalizeWipeSelection(OPS_WIPE_KEYS.filter((key) => key !== 'elektrawebOutbox'));
    expect(kept).not.toContain('elektrawebOutbox');
    expect(kept).toContain('guests');
    expect(kept).toContain('reservations');
  });

  it('ignores unknown keys', () => {
    expect(normalizeWipeSelection(['guests', 'roomTypes'])).toEqual([]);
  });
});
