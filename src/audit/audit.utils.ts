const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'apikey',
  'secret',
  'authorization',
  'cookie',
  'clientsecret',
]);

const MAX_BODY_LENGTH = 5000;

export function sanitizeBody(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeBody(value);
    } else {
      result[key] = value;
    }
  }

  const serialized = JSON.stringify(result);
  if (serialized.length > MAX_BODY_LENGTH) {
    return { _truncated: true, _size: serialized.length };
  }

  return result;
}

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'REPLACE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

export function mapMethodToAction(method: string): string {
  return METHOD_ACTION_MAP[method.toUpperCase()] ?? method.toUpperCase();
}

export function resolveResource(path: string): string {
  const segments = path.replace(/^\//, '').split('/');
  const first = segments[0] ?? 'unknown';
  return first.replace(/-/g, '_');
}

export function resolveResourceId(
  params: Record<string, string>,
): string | null {
  return params?.['id'] ?? params?.['resourceId'] ?? null;
}
