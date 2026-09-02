import { NextResponse } from 'next/server';
import { getConnectionId } from '@/lib/connectionUtils';
import { httpRequest } from '@/lib/httpRequest';
import {
    authHeaders,
    buildBaseUrl,
    resolveAllConnections,
    type ResolvedConnection,
} from '@/lib/serverConnections';
import { asObject, requireEnum, requireString, ValidationError } from '@/lib/validation';
import logger from '../logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A hostname label plus optional wildcard - keeps the rule we build well-formed.
const DOMAIN_PATTERN = /^[a-zA-Z0-9*]([a-zA-Z0-9-_.*]{0,251}[a-zA-Z0-9*])?$/;

/**
 * Adds or removes a blocking rule for a domain.
 *
 * Body: { domain, action: 'block' | 'unblock', connectionIds?: string[] }
 * Without `connectionIds` the rule is applied to every configured server.
 * Progress is streamed back as SSE so the UI can show a live log.
 */
export async function POST(request: Request) {
    let domain: string;
    let action: 'block' | 'unblock';
    let requestedIds: string[] | undefined;

    try {
        const body = asObject(await request.json());
        domain = requireString(body, 'domain', 253);
        if (!DOMAIN_PATTERN.test(domain)) {
            throw new ValidationError('Domain contains invalid characters');
        }
        action = requireEnum(body, 'action', ['block', 'unblock'] as const);

        if (body.connectionIds !== undefined && body.connectionIds !== null) {
            if (!Array.isArray(body.connectionIds) || body.connectionIds.some(id => typeof id !== 'string')) {
                throw new ValidationError('"connectionIds" must be an array of strings');
            }
            requestedIds = body.connectionIds as string[];
        }
    } catch (error) {
        const message = error instanceof ValidationError ? error.message : 'Domain and action are required.';
        return NextResponse.json({ message }, { status: 400 });
    }

    const rule = action === 'block' ? `||${domain}^` : `@@||${domain}^`;
    const oppositeRule = action === 'block' ? `@@||${domain}^` : `||${domain}^`;

    const all = await resolveAllConnections();
    const targets: ResolvedConnection[] = requestedIds
        ? all.filter(conn => requestedIds!.includes(getConnectionId(conn)))
        : all;

    const readableStream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const sendEvent = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            sendEvent({ message: `Starting to ${action} domain ${domain} on ${targets.length} server(s)...` });

            for (const conn of targets) {
                const name = getConnectionId(conn);
                try {
                    if (!conn.password) {
                        throw new Error('Stored password could not be decrypted.');
                    }

                    sendEvent({ message: `Processing server: ${name}` });

                    const base = buildBaseUrl(conn);
                    const headers = authHeaders(conn, { 'Content-Type': 'application/json' });

                    // Read the current rules first so we never clobber the user's own list.
                    sendEvent({ message: `Fetching existing rules from ${name}...` });
                    const statusResp = await httpRequest({
                        method: 'GET',
                        url: `${base}/control/filtering/status`,
                        headers,
                        allowInsecure: conn.allowInsecure,
                    });

                    if (statusResp.statusCode < 200 || statusResp.statusCode >= 300) {
                        throw new Error(`Failed to fetch filtering status: ${statusResp.statusCode}`);
                    }

                    const filteringStatus = JSON.parse(statusResp.body || '{}');
                    const existingRules: string[] = filteringStatus.user_rules || [];
                    sendEvent({ message: `Found ${existingRules.length} existing custom rule(s)` });

                    let updatedRules: string[];
                    if (existingRules.includes(rule)) {
                        sendEvent({ message: `Rule already exists, skipping...` });
                        updatedRules = existingRules;
                    } else {
                        // Drop the inverse rule so block/unblock cannot both be present.
                        updatedRules = existingRules.filter(r => r !== oppositeRule);
                        updatedRules.push(rule);
                        sendEvent({ message: `Adding ${action} rule...` });
                    }

                    const setResp = await httpRequest({
                        method: 'POST',
                        url: `${base}/control/filtering/set_rules`,
                        headers,
                        body: JSON.stringify({ rules: updatedRules }),
                        allowInsecure: conn.allowInsecure,
                    });

                    if (setResp.statusCode < 200 || setResp.statusCode >= 300) {
                        throw new Error(`AdGuard API error: ${setResp.statusCode} ${setResp.body}`);
                    }

                    sendEvent({ message: `Successfully applied rule on ${name}` });
                } catch (e) {
                    const err = e as Error;
                    logger.warn(`set-filtering-rule failed on ${name}: ${err.message}`);
                    sendEvent({ message: `Failed to apply rule on ${name}: ${err.message}` });
                }
            }

            sendEvent({ message: 'Finished.' });
            controller.close();
        }
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
