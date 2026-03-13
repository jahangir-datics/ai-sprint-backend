import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TransformedResponse<T> {
  data: T;
  message: string;
  statusCode: number;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode;
        // If the controller already returned a shaped response, pass it through
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'message' in data &&
          'statusCode' in data
        ) {
          return data as TransformedResponse<T>;
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
