import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from "@/lib/httpRequest";
import { authHeaders, buildBaseUrl } from "@/lib/serverConnections";
import { connectionFromBody, errorResponse } from "@/lib/apiConnection";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fetches status + stats for one stored connection.
 * Body: { connectionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { connection, error } = await connectionFromBody(await req.json());
    if (error) return error;

    const base = buildBaseUrl(connection);
    const headers = authHeaders(connection);
    logger.info(`POST /check-adguard called for target: ${base}`);

    let statusRes;
    try {
      statusRes = await httpRequest({ method: 'GET', url: `${base}/control/status`, headers, allowInsecure: connection.allowInsecure });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error(`Fetch error for AdGuard Home status: ${message}`);
      return NextResponse.json({ status: "error", message: `Failed to reach AdGuard Home: ${message}` }, { status: 502 });
    }

    let stats = null;
    try {
      const statsRes = await httpRequest({ method: 'GET', url: `${base}/control/stats`, headers, allowInsecure: connection.allowInsecure });
      if (statsRes.statusCode >= 200 && statsRes.statusCode < 300) {
        try { stats = JSON.parse(statsRes.body); } catch { stats = null; }
      }
    } catch {
      stats = null;
    }

    logger.info(`Status fetched for target: ${base}, status: ${statusRes.statusCode}`);
    return NextResponse.json({
      status: statusRes.statusCode >= 200 && statusRes.statusCode < 300 ? "connected" : "error",
      response: statusRes.body,
      code: statusRes.statusCode,
      stats,
    });
  } catch (error) {
    logger.error(`Internal server error in /check-adguard: ${error instanceof Error ? error.message : String(error)}`);
    return errorResponse(error, 'Internal server error');
  }
}
