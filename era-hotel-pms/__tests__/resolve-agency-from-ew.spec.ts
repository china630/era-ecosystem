import {
  agencyLabelFromElektrawebRow,
  resolveOrCreateAgencyIdFromLabel,
} from '@/lib/integration/elektraweb-bridge/resolve-agency-from-ew';
import { slugCode } from '@/lib/import/helpers';

describe('bridge agency resolve', () => {
  it('reads AGENCY and common FOCP aliases', () => {
    expect(
      agencyLabelFromElektrawebRow({ AGENCY: 'Vita Travel medical' }),
    ).toBe('Vita Travel medical');
    expect(
      agencyLabelFromElektrawebRow({
        AGENCYID_AGENCYCODE: 'RADIO WALKIN MEDICAL',
      }),
    ).toBe('RADIO WALKIN MEDICAL');
    expect(agencyLabelFromElektrawebRow({ AGENCYNAME: 'Booking.com' })).toBe(
      'Booking.com',
    );
  });

  it('matches by slug code or creates', async () => {
    const created: Array<Record<string, unknown>> = [];
    const db = {
      agency: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: 'ag-new', code: String(data.code), name: String(data.name) };
        },
      },
    };
    const id = await resolveOrCreateAgencyIdFromLabel(
      'Vita Travel medical',
      db as never,
      'org-1',
    );
    expect(id).toBe('ag-new');
    expect(created[0]?.code).toBe(slugCode('Vita Travel medical'));
    expect(created[0]?.name).toBe('Vita Travel medical');
    expect(created[0]?.organizationId).toBe('org-1');
  });

  it('reuses existing agency by name', async () => {
    const db = {
      agency: {
        findFirst: async () => ({
          id: 'ag-vita',
          code: 'VITA_TRAVEL_MEDICAL',
          name: 'Vita Travel medical',
        }),
        create: async () => {
          throw new Error('should not create');
        },
      },
    };
    await expect(
      resolveOrCreateAgencyIdFromLabel('Vita Travel medical', db as never, 'org-1'),
    ).resolves.toBe('ag-vita');
  });
});
