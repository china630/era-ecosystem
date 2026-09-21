/** Credential schemas per providerId — kit owns validation; orch stores ciphertext blob. */

export type ProviderCredentialSchema = {
  providerId: string;
  fields: Array<{
    key: string;
    label: string;
    secret?: boolean;
    required?: boolean;
  }>;
};

export const FISCAL_PROVIDER_CREDENTIAL_SCHEMAS: ProviderCredentialSchema[] = [
  {
    providerId: "mock",
    fields: [],
  },
  {
    providerId: "omnitech",
    fields: [
      { key: "apiToken", label: "API token", secret: true, required: false },
      { key: "agentUrl", label: "Agent URL", required: false },
    ],
  },
  {
    providerId: "nbc",
    fields: [
      { key: "apiToken", label: "Bearer token", secret: true, required: false },
      { key: "endpoint", label: "HTTP endpoint", required: false },
      { key: "pkcs12Base64", label: "PKCS#12 (base64)", secret: true, required: false },
      { key: "pkcs12Password", label: "PKCS#12 password", secret: true, required: false },
    ],
  },
  {
    providerId: "cybernet",
    fields: [
      { key: "apiToken", label: "API token", secret: true, required: false },
      { key: "endpoint", label: "HTTP endpoint", required: false },
    ],
  },
];

export function credentialSchemaForProvider(
  providerId: string,
): ProviderCredentialSchema | undefined {
  return FISCAL_PROVIDER_CREDENTIAL_SCHEMAS.find(
    (s) => s.providerId === providerId.trim().toLowerCase(),
  );
}
