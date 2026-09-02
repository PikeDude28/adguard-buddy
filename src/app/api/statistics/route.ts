import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from "@/lib/httpRequest";
import { authHeaders, buildBaseUrl } from "@/lib/serverConnections";
import { connectionFromBody, errorResponse } from "@/lib/apiConnection";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fetches /control/stats for one stored connection.
 * Body: { connectionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { connection, error } = await connectionFromBody(await req.json());
    if (error) return error;

    const base = buildBaseUrl(connection);
    logger.info(`POST /statistics called for target: ${base}`);

    try {
      const r = await httpRequest({
        method: 'GET',
        url: `${base}/control/stats`,
        headers: authHeaders(connection),
        allowInsecure: connection.allowInsecure,
      });
      if (r.statusCode < 200 || r.statusCode >= 300) {
        logger.warn(`AdGuard Home responded with status ${r.statusCode} for ${base}/control/stats`);
        return NextResponse.json({ message: 'Failed to fetch stats from server', status: 'error' }, { status: 502 });
      }
      logger.info(`Statistics fetched successfully for target: ${base}`);
      return NextResponse.json(JSON.parse(r.body || '{}'));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error(`Fetch error for AdGuard Home statistics: ${message}`);
      return NextResponse.json({ message: `Failed to reach AdGuard Home: ${message}` }, { status: 502 });
    }
  } catch (error) {
    logger.error(`Internal server error in /statistics: ${error instanceof Error ? error.message : String(error)}`);
    return errorResponse(error, 'Internal server error');
  }
}
