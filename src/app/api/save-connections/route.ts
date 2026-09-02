import { NextResponse } from 'next/server';
import { getConnectionId } from '@/lib/connectionUtils';
import { encryptPassword } from '@/lib/crypto';
import {
    readMigratedStore,
    writeStore,
    getPublicStore,
    type StoredConnection,
} from '@/lib/serverConnections';
import {
    asObject,
    optionalBoolean,
    optionalInt,
    optionalString,
    requireString,
    validateTarget,
    ValidationError,
} from '@/lib/validation';
import logger from '../logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IncomingConnection = {
    ip?: string;
    url?: string;
    port?: number;
    username: string;
    /** Plaintext, only present when the user entered a new password. */
    password?: string;
    allowInsecure?: boolean;
    color?: string;
};

function parseConnection(raw: unknown, index: number): IncomingConnection {
    const obj = asObject(raw, `connections[${index}]`);
    const ip = optionalString(obj, 'ip', 255);
    const url = optionalString(obj, 'url', 2048);

    if (!ip && !url) {
        throw new ValidationError(`connections[${index}] must have either "ip" or "url"`);
    }
    validateTarget(url && url.length > 0 ? url : (ip as string));

    return {
        ip: ip || undefined,
        url: url || undefined,
        port: optionalInt(obj, 'port', { min: 1, max: 65535 }),
        username: requireString(obj, 'username', 255),
        password: optionalString(obj, 'password', 1024),
        allowInsecure: optionalBoolean(obj, 'allowInsecure'),
        color: optionalString(obj, 'color', 32),
    };
}

/**
 * Replaces the stored connection list.
 *
 * Clients send plaintext passwords only for entries the user actually changed;
 * omitting `password` keeps whatever ciphertext is already on disk for that
 * connection id. Encryption happens here, never in the browser.
 */
export async function POST(request: Request) {
    let incoming: IncomingConnection[];
    let masterServerIp: string | null;

    try {
        const body = asObject(await request.json());
        const rawConnections = body.connections;
        if (!Array.isArray(rawConnections)) {
            throw new ValidationError('"connections" must be an array');
        }
        if (rawConnections.length > 100) {
            throw new ValidationError('Too many connections (max 100)');
        }
        incoming = rawConnections.map(parseConnection);

        const master = optionalString(body, 'masterServerIp', 2048);
        masterServerIp = master && master.length > 0 ? master : null;
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        const err = error as Error;
        return NextResponse.json({ message: 'Invalid request body.', error: err.message }, { status: 400 });
    }

    try {
        const existing = await readMigratedStore();
        const existingById = new Map(existing.connections.map(c => [getConnectionId(c), c]));

        const connections: StoredConnection[] = incoming.map((conn, index) => {
            const id = getConnectionId(conn);
            const previous = existingById.get(id);

            let password: string;
            if (conn.password && conn.password.length > 0) {
                password = encryptPassword(conn.password);
            } else if (previous?.password) {
                password = previous.password;
            } else {
                throw new ValidationError(`connections[${index}] is new and requires a password`);
            }

            return {
                ip: conn.ip,
                url: conn.url,
                port: conn.port,
                username: conn.username,
                password,
                allowInsecure: conn.allowInsecure,
                color: conn.color,
            };
        });

        const knownIds = new Set(connections.map(getConnectionId));
        const master = masterServerIp && knownIds.has(masterServerIp) ? masterServerIp : null;
        if (masterServerIp && !master) {
            logger.warn(`Discarding master server "${masterServerIp}" - no matching connection.`);
        }

        await writeStore({ connections, masterServerIp: master });

        // Echo the public view back so the client can update without a refetch.
        const store = await getPublicStore();
        return NextResponse.json({ message: 'Connections saved successfully.', ...store });
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        const err = error as Error;
        logger.error(`Failed to save connections: ${err.message}`);
        return NextResponse.json({ message: 'Failed to save connections.', error: err.message }, { status: 500 });
    }
}
