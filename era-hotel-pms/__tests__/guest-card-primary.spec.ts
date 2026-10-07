import {
  formatPrimaryDocumentLabel,
  pickPrimaryContact,
  pickPrimaryDocument,
} from '../src/lib/guest-card-primary';

describe('guest card primary rows', () => {
  it('prefers the primary contact of the requested kind', () => {
    expect(
      pickPrimaryContact(
        [
          { kind: 'MOBILE', value: '+994501112233', isPrimary: false },
          { kind: 'PHONE', value: '+994125550000', isPrimary: true },
          { kind: 'EMAIL', value: 'a@b.c', isPrimary: true },
        ],
        ['MOBILE', 'PHONE'],
      ),
    ).toBe('+994125550000');
  });

  it('falls back to the first filled document type', () => {
    expect(
      pickPrimaryDocument(
        [
          { docType: 'VISA', docNumber: 'V1', isPrimary: true },
          { docType: 'PASSPORT', docNumber: 'AA1' },
        ],
        ['PASSPORT', 'ID_CARD'],
      ),
    ).toBe('AA1');
  });

  it('labels the primary document row', () => {
    expect(
      formatPrimaryDocumentLabel([
        { docType: 'FIN', docNumber: 'ABC1234' },
        { docType: 'PASSPORT', docNumber: 'AA9', isPrimary: true },
      ]),
    ).toBe('PASSPORT AA9');
  });
});
