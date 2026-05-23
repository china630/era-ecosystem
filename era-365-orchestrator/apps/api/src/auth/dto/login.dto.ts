export class LoginDto {
  email!: string;
  password!: string;
  /** Optional org context; defaults to first membership. */
  organizationId?: string;
}
