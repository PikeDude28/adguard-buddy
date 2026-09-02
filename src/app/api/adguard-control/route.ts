import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from "@/lib/httpRequest";
import { authHeaders, buildBaseUrl } from "@/lib/serverConnections";
import { connectionFromBody, errorResponse } from "@/lib/apiConnection";
import { asObject, requireBoolean } from "@/lib/validation";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Toggles DNS protection on one stored connection.
 * Body: { connectionId: string, protection_enabled: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const protectionEnabled = requireBoolean(asObject(body), 'protection_enabled');

    const { connection, error } = await connectionFromBody(body);
    if (error) return error;

    const base = buildBaseUrl(connection);
    logger.info(`POST /adguard-control called for target: ${base}, protection_enabled: ${protectionEnabled}`);

    const headers = authHeaders(connection, { "Content-Type": "application/json" });

    let response;
    try {
      response = await httpRequest({
        method: 'POST',
        url: `${base}/control/dns_config`,
        headers,
        body: JSON.stringify({ protection_enabled: protectionEnabled }),
        allowInsecure: connection.allowInsecure,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error(`Fetch error for AdGuard Home: ${message}`);
      return NextResponse.json({ status: "error", message: `Failed to reach AdGuard Home: ${message}` }, { status: 502 });
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      logger.warn(`AdGuard Home responded with error: ${response.body}`);
      return NextResponse.json(
        { status: "error", message: `Failed to update AdGuard Home protection status: ${response.body}` },
        { status: response.statusCode },
      );
    }

    logger.info(`Protection status updated successfully for target: ${base}`);
    return NextResponse.json({ status: "success", message: "Protection status updated successfully." });
  } catch (error) {
    logger.error(`Internal server error in /adguard-control: ${error instanceof Error ? error.message : String(error)}`);
    return errorResponse(error, 'Internal server error');
  }
}
