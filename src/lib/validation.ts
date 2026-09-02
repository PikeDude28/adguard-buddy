/**
 * Small hand-rolled validators for API request bodies.
 *
 * Deliberately dependency-free: the shapes here are tiny and adding a schema
 * library for four object types would not earn its weight.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function fail(message: string): never {
  throw new ValidationError(message);
}

export function asObject(value: unknown, what = 'body'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`Expected ${what} to be an object`);
  }
  return value as Record<string, unknown>;
}

export function requireString(obj: Record<string, unknown>, key: string, maxLength = 2048): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) fail(`"${key}" is required and must be a non-empty string`);
  if (value.length > maxLength) fail(`"${key}" exceeds ${maxLength} characters`);
  return value;
}

export function optionalString(obj: Record<string, unknown>, key: string, maxLength = 2048): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') fail(`"${key}" must be a string`);
  if (value.length > maxLength) fail(`"${key}" exceeds ${maxLength} characters`);
  return value;
}

export function optionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const value = obj[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') fail(`"${key}" must be a boolean`);
  return value;
}

export function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') fail(`"${key}" is required and must be a boolean`);
  return value;
}

export function optionalInt(
  obj: Record<string, unknown>,
  key: string,
  { min, max }: { min: number; max: number },
): number | undefined {
  const value = obj[key];
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) fail(`"${key}" must be an integer`);
  if (num < min || num > max) fail(`"${key}" must be between ${min} and ${max}`);
  return num;
}

export function requireEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = obj[key];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`"${key}" must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  return requireEnum(obj, key, allowed);
}

/**
 * Validates that a user-supplied target is a plain host, host:port or http(s) URL.
 * Rejects anything that would let the server be pointed at a non-HTTP scheme.
 */
export function validateTarget(target: string): void {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      fail('Target is not a valid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      fail('Only http:// and https:// targets are supported');
    }
    if (!parsed.hostname) fail('Target URL has no host');
    return;
  }

  const [host, port] = target.split(':');
  if (!host || !/^[a-zA-Z0-9._-]+$/.test(host)) fail('Target host contains invalid characters');
  if (port !== undefined) {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) fail('Target port is invalid');
  }
}
