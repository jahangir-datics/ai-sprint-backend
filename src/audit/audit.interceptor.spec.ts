import {
  sanitizeBody,
  mapMethodToAction,
  resolveResource,
  resolveResourceId,
} from './audit.utils';

describe('Audit Utils', () => {
  describe('sanitizeBody', () => {
    it('should redact sensitive keys', () => {
      const result = sanitizeBody({
        email: 'test@example.com',
        password: 'secret123', // NOSONAR — test fixture
        token: 'abc',
      });
      expect(result).toEqual({
        email: 'test@example.com',
        password: '[REDACTED]',
        token: '[REDACTED]',
      });
    });

    it('should redact nested sensitive keys', () => {
      const result = sanitizeBody({
        user: { name: 'Test', accessToken: 'xyz' },
      });
      expect(result).toEqual({
        user: { name: 'Test', accessToken: '[REDACTED]' },
      });
    });

    it('should return null for non-object input', () => {
      expect(sanitizeBody(null)).toBeNull();
      expect(sanitizeBody('string')).toBeNull();
    });

    it('should truncate large payloads', () => {
      const large = { data: 'x'.repeat(10000) };
      const result = sanitizeBody(large);
      expect(result).toHaveProperty('_truncated', true);
    });
  });

  describe('mapMethodToAction', () => {
    it('should map HTTP methods to actions', () => {
      expect(mapMethodToAction('POST')).toBe('CREATE');
      expect(mapMethodToAction('PATCH')).toBe('UPDATE');
      expect(mapMethodToAction('DELETE')).toBe('DELETE');
      expect(mapMethodToAction('PUT')).toBe('REPLACE');
    });
  });

  describe('resolveResource', () => {
    it('should extract resource from path', () => {
      expect(resolveResource('/webhooks/123')).toBe('webhooks');
      expect(resolveResource('/feature-flags/456')).toBe('feature_flags');
      expect(resolveResource('/auth/login')).toBe('auth');
    });
  });

  describe('resolveResourceId', () => {
    it('should extract id from params', () => {
      expect(resolveResourceId({ id: '123' })).toBe('123');
      expect(resolveResourceId({})).toBeNull();
    });
  });
});
