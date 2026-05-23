export class SsoExchangeDto {
  email!: string;
  organizationId!: string;
  expiresAt!: number;
  signature!: string;
  role?: string;
}
