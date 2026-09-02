import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from "@/lib/httpRequest";
import { authHeaders, buildBaseUrl } from "@/lib/serverConnections";
import { connectionFromBody, errorResponse } from "@/lib/apiConnection";
import { asObject, optionalEnum, optionalInt } from "@/lib/validation";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_STATUSES = [
  'all', 'filtered', 'blocked', 'blocked_safebrowsing', 'blocked_parental',
  'whitelisted', 'rewritten', 'safe_search', 'processed',
] as const;

/**
 * Fetches the query log for one stored connection.
 * Body: { connectionId, limit?, offset?, response_status? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = asObject(body);
    const limit = optionalInt(parsed, 'limit', { min: 1, max: 5000 }) ?? 100;
    const offset = optionalInt(parsed, 'offset', { min: 0, max: 1_000_000 }) ?? 0;
    const responseStatus = optionalEnum(parsed, 'response_status', RESPONSE_STATUSES) ?? 'all';

    const { connection, error } = await connectionFromBody(body);
    if (error) return error;

    const base = buildBaseUrl(connection);
    logger.info(`POST /query-log called for target: ${base}, limit: ${limit}, offset: ${offset}, response_status: ${responseStatus}`);

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      response_status: responseStatus,
    });
    const fullUrl = `${base}/control/querylog?${params.toString()}`;

    try {
      const res = await httpRequest({
        method: 'GET',
        url: fullUrl,
        headers: authHeaders(connection),
        allowInsecure: connection.allowInsecure,
      });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        logger.warn(`AdGuard Home responded with status ${res.statusCode} for ${fullUrl}`);
        return NextResponse.json({ status: 'error', message: 'Failed to fetch query log from AdGuard Home' }, { status: 502 });
      }
      logger.info(`Query log fetched successfully for target: ${base}`);
      return NextResponse.json(JSON.parse(res.body || '{}'));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error(`Fetch error for AdGuard Home query-log: ${message}`);
      return NextResponse.json({ status: 'error', message: `Failed to reach AdGuard Home: ${message}` }, { status: 502 });
    }
  } catch (error) {
    logger.error(`Internal server error in /query-log: ${error instanceof Error ? error.message : String(error)}`);
    return errorResponse(error, 'Internal server error');
  }
}
