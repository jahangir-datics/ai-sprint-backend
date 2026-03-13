import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  function createContext(statusCode: number): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should wrap plain data in standard response format', (done) => {
    const context = createContext(200);
    const handler: CallHandler = { handle: () => of({ name: 'Test' }) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({
        data: { name: 'Test' },
        message: 'Success',
        statusCode: 200,
      });
      done();
    });
  });

  it('should pass through already-shaped responses', (done) => {
    const context = createContext(201);
    const shaped = {
      data: { id: '1' },
      message: 'Created',
      statusCode: 201,
    };
    const handler: CallHandler = { handle: () => of(shaped) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual(shaped);
      done();
    });
  });

  it('should handle null data', (done) => {
    const context = createContext(200);
    const handler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({
        data: null,
        message: 'Success',
        statusCode: 200,
      });
      done();
    });
  });
});
