import axios from 'axios';

export interface TourismGuestPayload {
  fullName: string;
  passportNumber: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string | null;
  roomTypeCode: string;
  propertyCode: string;
}

export interface TourismAdapterResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface TourismRegistryAdapter {
  submitCheckIn(payload: TourismGuestPayload): Promise<TourismAdapterResult>;
  submitCheckOut(payload: TourismGuestPayload): Promise<TourismAdapterResult>;
}

export class MockTourismAdapter implements TourismRegistryAdapter {
  async submitCheckIn(payload: TourismGuestPayload): Promise<TourismAdapterResult> {
    return { ok: true, externalId: `MOCK-IN-${Date.now()}` };
  }

  async submitCheckOut(payload: TourismGuestPayload): Promise<TourismAdapterResult> {
    return { ok: true, externalId: `MOCK-OUT-${Date.now()}` };
  }
}

export class HttpTourismAdapter implements TourismRegistryAdapter {
  constructor(private url: string) {}

  async submitCheckIn(payload: TourismGuestPayload): Promise<TourismAdapterResult> {
    return this.post('check-in', payload);
  }

  async submitCheckOut(payload: TourismGuestPayload): Promise<TourismAdapterResult> {
    return this.post('check-out', payload);
  }

  private async post(path: string, payload: TourismGuestPayload): Promise<TourismAdapterResult> {
    try {
      const res = await axios.post(`${this.url}/${path}`, payload, { timeout: 10000 });
      return { ok: true, externalId: res.data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tourism registry error';
      return { ok: false, error: message };
    }
  }
}

export function getTourismAdapter(): TourismRegistryAdapter {
  const enabled = process.env.TOURISM_REGISTRY_ENABLED === 'true';
  const url = process.env.TOURISM_REGISTRY_URL;
  if (enabled && url) return new HttpTourismAdapter(url);
  return new MockTourismAdapter();
}
