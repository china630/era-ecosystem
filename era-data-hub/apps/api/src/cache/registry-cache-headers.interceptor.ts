import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, of, from } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import { RegistryCacheService } from "./registry-cache.service";

@Injectable()
export class RegistryCacheHeadersInterceptor implements NestInterceptor {
  constructor(private readonly cache: RegistryCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (req.method !== "GET") {
      return next.handle();
    }

    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith("/registry/v1/") && !path.startsWith("/")) {
      return next.handle();
    }

    const registryPath = path.replace(/^\/registry\/v1/, "") || path;
    const query = req.url?.includes("?") ? req.url.split("?")[1] ?? "" : "";
    const key = this.cache.cacheKey(registryPath, query);
    const ttl = this.cache.ttlForPath(registryPath);

    return from(this.cache.get(key)).pipe(
      switchMap((hit) => {
        if (hit) {
          const inm = req.headers["if-none-match"];
          if (inm === hit.etag) {
            res.status(304).end();
            return of(undefined);
          }
          res.setHeader("ETag", hit.etag);
          res.setHeader("Cache-Control", `public, max-age=${ttl}`);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.status(200).send(hit.body);
          return of(undefined);
        }

        return next.handle().pipe(
          tap((body) => {
            if (body === undefined) return;
            const json = JSON.stringify(body);
            void this.cache.set(key, json, ttl).then((etag) => {
              res.setHeader("ETag", etag);
              res.setHeader("Cache-Control", `public, max-age=${ttl}`);
            });
          }),
        );
      }),
    );
  }
}
