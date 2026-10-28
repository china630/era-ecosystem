/**
 * Layer A mutation belt (ERA reference) — docs/adr/era-mutation-audit-standard.md / FIN-AUD-01.
 * Global mutation capture: POST / PATCH / PUT / DELETE.
 * Deny-list = kit DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES + FINANCE_MUTATION_AUDIT_EXEMPT_EXTRA (AC-FIN-AUD).
 * Entity snapshots for Invoice/Employee/Product/JournalEntry; else HTTP_MUTATION + hash-chain.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, from, of } from "rxjs";
import { mergeMap } from "rxjs/operators";
import type { AuthUser } from "../auth/types/auth-user";
import { AuditService } from "./audit.service";
import { isFinanceMutationAuditExempt } from "./mutation-audit-exempt";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

@Injectable()
export class AuditMutationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditMutationInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      path?: string;
      url?: string;
      body?: unknown;
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
    }>();

    if (!MUTATION_METHODS.has(req.method)) {
      return next.handle();
    }

    const pathRaw = req.path ?? req.url ?? "";
    if (isFinanceMutationAuditExempt(pathRaw)) {
      return next.handle();
    }

    return from(this.audit.loadOldSnapshot(req)).pipe(
      mergeMap((oldSnapshot) =>
        next.handle().pipe(
          mergeMap((responseBody: unknown) => {
            void this.audit
              .persistAfterMutation({
                req,
                responseBody,
                oldSnapshot,
              })
              .catch((err: unknown) => {
                const msg =
                  err instanceof Error ? err.message : String(err);
                this.logger.error(`persistAfterMutation failed: ${msg}`);
              });
            return of(responseBody);
          }),
        ),
      ),
    );
  }
}
