import { NextResponse } from 'next/server';
import { getPublicStore } from '@/lib/serverConnections';
import logger from '../logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the configured connections without any credential material.
 * Passwords stay on the server; clients address a connection by its id.
 */
export async function GET() {
    try {
        const store = await getPublicStore();
        return NextResponse.json(store);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err instanceof SyntaxError) {
            logger.error(`Failed to parse connections file: ${err.message}`);
            return NextResponse.json({ message: 'Failed to parse connections data.', error: err.message }, { status: 500 });
        }
        logger.error(`Failed to read connections file: ${err.message}`);
        return NextResponse.json({ message: 'Failed to read connections file.', error: err.message }, { status: 500 });
    }
}
