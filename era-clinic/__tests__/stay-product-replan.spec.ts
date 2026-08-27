import {
  shouldCancelProcedureOnStayProductChange,
  shouldKeepProcedureOnStayProductChange,
} from '@/lib/stay-product-replan';

describe('stay product remaining replan', () => {
  it('cancels remaining PROPOSED and SCHEDULED', () => {
    expect(shouldCancelProcedureOnStayProductChange('PROPOSED')).toBe(true);
    expect(shouldCancelProcedureOnStayProductChange('SCHEDULED')).toBe(true);
  });

  it('keeps completed and in-progress execution', () => {
    expect(shouldKeepProcedureOnStayProductChange('COMPLETED')).toBe(true);
    expect(shouldKeepProcedureOnStayProductChange('CHECKED_IN')).toBe(true);
    expect(shouldCancelProcedureOnStayProductChange('COMPLETED')).toBe(false);
  });
});
