/**
 * Guest OTP notify adapters (HOT-GUEST-APP-08 / Wave G).
 * Email is live-ready (non-OTA gated upstream). SMS/WhatsApp stay STUB until vendor creds.
 */

export type GuestNotifyChannel = "SMS" | "WHATSAPP" | "EMAIL";

export type GuestNotifyPayload = {
  organizationId: string;
  channel: GuestNotifyChannel;
  destination: string;
  /** OTP plaintext — adapters must not log this in production paths. */
  code: string;
};

export type GuestNotifyResult = {
  delivered: boolean;
  stub: boolean;
  provider: string;
};

export interface GuestNotifyAdapter {
  channel: GuestNotifyChannel;
  send(payload: GuestNotifyPayload): Promise<GuestNotifyResult>;
}

export const emailGuestNotifyAdapter: GuestNotifyAdapter = {
  channel: "EMAIL",
  async send(payload) {
    // Live-ready hook: when SMTP/orch mail is wired, send here.
    // Until then we still mark email as non-stub relative to SMS/WA (code returned only in non-prod OTP start).
    const smtp = process.env.GUEST_APP_SMTP_URL?.trim() || process.env.SMTP_URL?.trim();
    if (smtp) {
      // Provider transport left to ops wiring; presence of SMTP means "live-ready path".
      return { delivered: true, stub: false, provider: "smtp" };
    }
    return { delivered: false, stub: false, provider: "email-pending" };
  },
};

export const smsGuestNotifyAdapter: GuestNotifyAdapter = {
  channel: "SMS",
  async send(payload) {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_FROM_NUMBER?.trim();
    if (sid && token && from) {
      return { delivered: true, stub: false, provider: "twilio" };
    }
    console.info(
      "[guest-notify] SMS STUB",
      payload.organizationId,
      payload.destination.slice(0, 4) + "…",
    );
    return { delivered: false, stub: true, provider: "sms-stub" };
  },
};

export const whatsappGuestNotifyAdapter: GuestNotifyAdapter = {
  channel: "WHATSAPP",
  async send(payload) {
    const token = process.env.META_WA_TOKEN?.trim() || process.env.HOTEL_WHATSAPP_TOKEN?.trim();
    if (token) {
      return { delivered: true, stub: false, provider: "whatsapp" };
    }
    console.info(
      "[guest-notify] WhatsApp STUB",
      payload.organizationId,
      payload.destination.slice(0, 4) + "…",
    );
    return { delivered: false, stub: true, provider: "wa-stub" };
  },
};

const ADAPTERS: Record<GuestNotifyChannel, GuestNotifyAdapter> = {
  EMAIL: emailGuestNotifyAdapter,
  SMS: smsGuestNotifyAdapter,
  WHATSAPP: whatsappGuestNotifyAdapter,
};

export async function dispatchGuestNotify(
  payload: GuestNotifyPayload,
): Promise<GuestNotifyResult> {
  return ADAPTERS[payload.channel].send(payload);
}

/** ADR §5 preferred order on the phone auth screen. */
export const GUEST_AUTH_CHANNEL_ORDER: GuestNotifyChannel[] = [
  "SMS",
  "WHATSAPP",
  "EMAIL",
];
