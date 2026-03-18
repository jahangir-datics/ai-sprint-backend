import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from './audit.service.js';
import {
  sanitizeBody,
  mapMethodToAction,
  resolveResource,
  resolveResourceId,
} from './audit.utils.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const method = req.method?.toUpperCase();
    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const user = req.user as { id: string } | undefined;

    const baseAudit = {
      userId: user?.id ?? null,
      action: mapMethodToAction(method),
      resource: resolveResource(req.originalUrl ?? req.url),
      resourceId: resolveResourceId(req.params as Record<string, string>),
      method,
      path: req.originalUrl ?? req.url,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestBody: sanitizeBody(req.body as Record<string, unknown>),
    };

    return next.handle().pipe(
      tap((responseBody) => {
        void this.auditService.create({
          ...baseAudit,
          responseBody: sanitizeBody(responseBody as Record<string, unknown>),
          statusCode: res.statusCode,
          success: res.statusCode < 400,
          details: { durationMs: Date.now() - startedAt },
        });
      }),
      catchError((error: { status?: number; message?: string }) => {
        const statusCode = error?.status ?? 500;
        void this.auditService.create({
          ...baseAudit,
          statusCode,
          success: false,
          responseBody: null,
          details: {
            durationMs: Date.now() - startedAt,
            errorMessage: error?.message ?? 'Unknown error',
          },
        });
        return throwError(() => error);
      }),
    );
  }
}
