import http from 'http';
import https from 'https';
import { RequestOptions } from 'http';

/** Default socket/response timeout so an unreachable server cannot hang a request forever. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Returns the default timeout for outgoing AdGuard Home requests.
 *
 * ADGUARD_BUDDY_REQUEST_TIMEOUT_MS can override the built-in 15 second default.
 * Set it to 0 to disable the timeout. Invalid or negative values fall back to
 * DEFAULT_TIMEOUT_MS.
 */
export function getDefaultTimeoutMs(): number {
  const configured = process.env.ADGUARD_BUDDY_REQUEST_TIMEOUT_MS;

  if (configured === undefined || configured.trim() === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(configured);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

export type HttpRequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
  allowInsecure?: boolean;
  /** Milliseconds before the request is aborted. Defaults to the configured global timeout. */
  timeoutMs?: number;
};

export type HttpRequestResult = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

/**
 * Minimal promise wrapper around node:http/https.
 *
 * This is the single HTTP client for all outgoing AdGuard Home calls. It exists
 * instead of `fetch` because self-signed certificates must be accepted per
 * connection (`allowInsecure`), which undici does not expose per request.
 */
export async function httpRequest(opts: HttpRequestOptions): Promise<HttpRequestResult> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(opts.url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const timeoutMs = opts.timeoutMs ?? getDefaultTimeoutMs();

      const requestOptions: RequestOptions = {
        method: opts.method,
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: opts.headers || {},
      };

      if (isHttps && opts.allowInsecure) {
        (requestOptions as RequestOptions & { rejectUnauthorized?: boolean }).rejectUnauthorized = false;
      }

      const req = lib.request(requestOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: data }));
      });

      req.on('error', (err) => reject(err));

      if (timeoutMs > 0) {
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`Request to ${parsed.host} timed out after ${timeoutMs}ms`));
        });
      }

      if (opts.body) {
        req.write(opts.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
