import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from "@/lib/httpRequest";
import { authHeaders, buildBaseUrl } from "@/lib/serverConnections";
import { connectionFromBody, errorResponse } from "@/lib/apiConnection";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Triggers a filter list refresh on one stored connection.
 * Body: { connectionId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { connection, error } = await connectionFromBody(await req.json());
        if (error) return error;

        const base = buildBaseUrl(connection);
        logger.info(`POST /refresh-filters called for: ${base}`);

        const headers = authHeaders(connection, {
            "User-Agent": "curl/8.0.1",
            "Accept": "*/*",
            "Content-Type": "application/json",
        });

        const response = await httpRequest({
            method: 'POST',
            url: `${base}/control/filtering/refresh`,
            headers,
            // `whitelist: false` refreshes the blocklists rather than the allowlists.
            body: JSON.stringify({ whitelist: false }),
            allowInsecure: connection.allowInsecure,
            // Filter downloads on the AdGuard side can take a while.
            timeoutMs: 60_000,
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
            logger.info(`Filter refresh triggered successfully on ${base}`);
            let responseData;
            try {
                responseData = JSON.parse(response.body || '{}');
            } catch {
                responseData = { message: 'Refresh triggered' };
            }
            return NextResponse.json({ success: true, message: 'Filter lists refresh triggered', data: responseData });
        }

        logger.error(`Filter refresh failed on ${base}: ${response.statusCode}`);
        return NextResponse.json(
            { success: false, error: `Failed with status ${response.statusCode}`, body: response.body },
            { status: response.statusCode },
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error refreshing filters: ${errorMessage}`);
        return errorResponse(error, 'Failed to refresh filters');
    }
}
