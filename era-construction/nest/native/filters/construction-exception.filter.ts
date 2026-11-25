import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { handleRouteError } from "@/lib/api-utils";
import type { Response } from "express";

@Catch()
export class ConstructionExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === "string" ? { error: body } : body);
      return;
    }
    const next = handleRouteError(exception);
    res.status(next.status).json(next.body);
  }
}

export function serviceError(result: { error: string; status: number }): never {
  throw new HttpException({ error: result.error }, result.status);
}

export function assertOk<T extends object>(
  result: T | { error: string; status: number },
): T {
  if (result && typeof result === "object" && "error" in result && "status" in result) {
    serviceError(result as { error: string; status: number });
  }
  return result as T;
}
