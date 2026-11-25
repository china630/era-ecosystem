export type FieldType =
  | "string"
  | "secret"
  | "url"
  | "phone"
  | "number"
  | "select"
  | "boolean"
  | "json"
  | "oauth";

export type IntegrationCategory =
  | "MESSENGER"
  | "SMS"
  | "EMAIL"
  | "TELEPHONY"
  | "LEAD_FORM"
  | "WEB_CHAT"
  | "CALENDAR"
  | "ANALYTICS"
  | "ADS"
  | "PAYMENT"
  | "AI"
  | "STORAGE"
  | "OTHER";

export interface ManifestField {
  key: string;
  label: { ru: string; az: string; en: string };
  type: FieldType;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  help?: { ru: string; az: string; en: string };
  helpUrl?: string;
  pattern?: string;
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  showIf?: { field: string; equals: unknown };
}

export interface ProviderManifest {
  key: string;
  name: string;
  category: IntegrationCategory;
  family?: string;
  regions: string[];
  tier: "P0" | "P1" | "P2";
  docsUrl: string;
  verified: "V" | "C" | "U";
  auth: string;
  fields: ManifestField[];
  inbound: {
    mode: "webhook" | "polling" | "socket" | "bridge" | "none";
    events: string[];
    verify: string;
  };
  outbound: string[];
  capabilities: Record<string, boolean>;
  limits?: string;
  rateLimit?: { perSecond?: number; perMinute?: number; burst?: number };
  setupSteps: { ru: string[]; az?: string[]; en?: string[] };
  autoRegisterWebhook?: boolean;
}

export interface AdapterContext {
  connectionId: string;
  organizationId: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  webhookUrl: string;
  webhookSecret: string;
  http: HttpClient;
  log: {
    info: (m: string, meta?: unknown) => void;
    warn: (m: string, meta?: unknown) => void;
    error: (m: string, meta?: unknown) => void;
  };
}

export interface HttpClient {
  request(input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<{ status: number; json: unknown; text: string }>;
}

export interface TestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface VerifyResult {
  ok: boolean;
  challengeResponse?: string;
  reason?: string;
}

export interface RawRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  query: Record<string, string | undefined>;
  /** Trailing path after hook publicId (e.g. events/call). */
  subPath?: string;
  contentType?: string;
}

export interface AdapterHttpResponse {
  status: number;
  body: string;
  contentType?: string;
}

export type NormalizedEvent =
  | {
      kind: "message.in";
      chatId: string;
      contact: ContactRef;
      message: InMessage;
      at: string;
    }
  | {
      kind: "message.status";
      externalId: string;
      status: "SENT" | "DELIVERED" | "READ" | "FAILED";
      error?: string;
      at: string;
    }
  | {
      kind: "call.ringing" | "call.answered" | "call.ended" | "call.missed";
      call: CallRef;
      at: string;
    }
  | { kind: "call.recording"; externalCallId: string; url?: string; at: string }
  | {
      kind: "lead.captured";
      source: string;
      fields: Record<string, string>;
      contact: ContactRef;
      utm?: Record<string, string>;
      at: string;
    };

export interface ContactRef {
  phone?: string;
  email?: string;
  name?: string;
  handle?: string;
}

export interface InMessage {
  externalId?: string;
  type: string;
  text?: string;
  mediaUrl?: string;
  payload?: Record<string, unknown>;
}

export interface CallRef {
  externalCallId: string;
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL";
  fromNumber?: string;
  toNumber?: string;
  extension?: string;
  durationSec?: number;
  recordingUrl?: string;
}

export interface OutboundMessage {
  chatId: string;
  type: string;
  text?: string;
  mediaUrl?: string;
  templateName?: string;
  payload?: Record<string, unknown>;
}

export interface BaseAdapter {
  manifest: ProviderManifest;
  testConnection(ctx: AdapterContext): Promise<TestResult>;
  onEnable?(ctx: AdapterContext): Promise<void>;
  onDisable?(ctx: AdapterContext): Promise<void>;
  verifyWebhook?(req: RawRequest, ctx: AdapterContext): VerifyResult;
  handleChallenge?(
    req: RawRequest,
    ctx: AdapterContext,
  ): { status: number; body: string } | null;
  normalize?(req: RawRequest, ctx: AdapterContext): Promise<NormalizedEvent[]>;
  /** Custom HTTP response after inbound normalize (Sipuni, VirtualATS, Graph, …). */
  respond?(
    events: NormalizedEvent[],
    req: RawRequest,
    ctx: AdapterContext,
  ): AdapterHttpResponse;
  idempotencyKey?(req: RawRequest): string | null;
}

export interface MessagingAdapter extends BaseAdapter {
  sendMessage(
    ctx: AdapterContext,
    msg: OutboundMessage,
  ): Promise<{ externalId: string; raw: unknown }>;
}

export interface TelephonyAdapter extends BaseAdapter {
  originateCall(
    ctx: AdapterContext,
    p: { fromExtension: string; to: string },
  ): Promise<{ externalCallId?: string }>;
  fetchRecording?(
    ctx: AdapterContext,
    ref: string,
  ): Promise<{ url?: string; stream?: Buffer }>;
}
