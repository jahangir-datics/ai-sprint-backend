import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TransformedResponse<T> {
  data: T;
  message: string;
  statusCode: number;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  TransformedResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data: T) => {
        const statusCode = response.statusCode;
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'message' in data &&
          'statusCode' in data
        ) {
          return data as unknown as TransformedResponse<T>;
        }
        return {
          data,
          message: 'Success',
          statusCode,
        };
      }),
    );
  }
}
