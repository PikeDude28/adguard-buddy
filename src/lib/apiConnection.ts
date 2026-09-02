import { NextResponse } from 'next/server';
import { asObject, requireString, ValidationError } from '@/lib/validation';
import { resolveConnection, type ResolvedConnection } from '@/lib/serverConnections';

/**
 * Resolves the `connectionId` in a request body to a connection with a
 * decrypted password.
 *
 * Routes take an id rather than credentials so that passwords never travel to
 * the browser and back. Returns either the connection or a ready-to-return
 * error response.
 */
export async function connectionFromBody(
  body: unknown,
): Promise<{ connection: ResolvedConnection; error: null } | { connection: null; error: NextResponse }> {
  let connectionId: string;
  try {
    connectionId = requireString(asObject(body), 'connectionId');
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : 'Invalid request body';
    return { connection: null, error: NextResponse.json({ status: 'error', message }, { status: 400 }) };
  }

  let connection: ResolvedConnection | null;
  try {
    connection = await resolveConnection(connectionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      connection: null,
      error: NextResponse.json(
        { status: 'error', message: `Could not read stored credentials: ${message}` },
        { status: 500 },
      ),
    };
  }

  if (!connection) {
    return {
      connection: null,
      error: NextResponse.json({ status: 'error', message: `Unknown connection: ${connectionId}` }, { status: 404 }),
    };
  }

  return { connection, error: null };
}

/** Maps a thrown ValidationError to a 400, anything else to a 500. */
export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ status: 'error', message: `${context}: ${message}` }, { status: 500 });
}
