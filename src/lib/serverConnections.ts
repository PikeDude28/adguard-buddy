import { promises as fs } from 'fs';
import path from 'path';
import { getConnectionId, type Connection } from '@/lib/connectionUtils';
import { decryptPassword, encryptPassword, isEncrypted } from '@/lib/crypto';

/**
 * Server-side access to the connection store.
 *
 * Credentials never leave this process: routes resolve a connection by its id
 * and get the plaintext password here. The browser only ever sees ids, hosts
 * and usernames (see `toPublicConnection`).
 */

export const DATA_FILE_PATH = path.join(process.cwd(), '.data', 'connections.json');

/** A connection as persisted on disk — `password` is ciphertext. */
export type StoredConnection = Connection;

/** A connection handed to route handlers — `password` is plaintext. */
export type ResolvedConnection = Omit<Connection, 'password'> & { password: string };

/** A connection safe to send to the browser — no password field at all. */
export type PublicConnection = {
  id: string;
  ip?: string;
  url?: string;
  port?: number;
  username: string;
  allowInsecure?: boolean;
  color?: string;
};

export type ConnectionStore = {
  connections: StoredConnection[];
  masterServerIp: string | null;
};

const EMPTY_STORE: ConnectionStore = { connections: [], masterServerIp: null };

export function toPublicConnection(conn: StoredConnection): PublicConnection {
  return {
    id: getConnectionId(conn),
    ip: conn.ip,
    url: conn.url,
    port: conn.port,
    username: conn.username,
    allowInsecure: conn.allowInsecure,
    color: conn.color,
  };
}

async function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath);
  try {
    await fs.stat(dirname);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      await fs.mkdir(dirname, { recursive: true });
    } else {
      throw error;
    }
  }
}

/** Reads the raw store. Returns an empty store when the file does not exist. */
export async function readStore(): Promise<ConnectionStore> {
  let fileContent: string;
  try {
    fileContent = await fs.readFile(DATA_FILE_PATH, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return { ...EMPTY_STORE };
    throw err;
  }

  const parsed = JSON.parse(fileContent) as Partial<ConnectionStore>;
  return {
    connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    masterServerIp: parsed.masterServerIp ?? null,
  };
}

export async function writeStore(store: ConnectionStore): Promise<void> {
  await ensureDirectoryExists(DATA_FILE_PATH);
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(store, null, 2));
}

/**
 * Normalizes a store that was written by an older version:
 *  - rewrites a `masterServerIp` that predates `getConnectionId` normalization
 *  - re-encrypts legacy crypto-js passwords into the authenticated v2 format
 *
 * Returns the normalized store plus whether anything changed.
 */
export function migrateStore(store: ConnectionStore): { store: ConnectionStore; migrated: boolean } {
  let migrated = false;
  const { connections } = store;
  let masterServerIp = store.masterServerIp;

  if (masterServerIp && connections.length > 0) {
    const masterExists = connections.some(conn => getConnectionId(conn) === masterServerIp);
    if (!masterExists) {
      const matched = connections.find(conn =>
        conn.ip === masterServerIp ||
        conn.url === masterServerIp ||
        (conn.ip && masterServerIp === `${conn.ip}:${conn.port || ''}`)
      );
      if (matched) {
        masterServerIp = getConnectionId(matched);
        migrated = true;
      }
    }
  }

  const upgraded = connections.map(conn => {
    if (!conn.password || isEncrypted(conn.password)) return conn;
    try {
      const plaintext = decryptPassword(conn.password);
      migrated = true;
      return { ...conn, password: encryptPassword(plaintext) };
    } catch {
      // Leave undecryptable entries untouched so the user can fix them by hand.
      return conn;
    }
  });

  return { store: { connections: upgraded, masterServerIp }, migrated };
}

/** Reads the store and transparently persists any migration it needed. */
export async function readMigratedStore(): Promise<ConnectionStore> {
  const raw = await readStore();
  const { store, migrated } = migrateStore(raw);
  if (migrated) {
    try {
      await writeStore(store);
    } catch {
      // Returning the migrated view is still correct even if persisting failed.
    }
  }
  return store;
}

/** The browser-facing view of the store. Never contains passwords. */
export async function getPublicStore(): Promise<{ connections: PublicConnection[]; masterServerIp: string | null }> {
  const store = await readMigratedStore();
  return {
    connections: store.connections.map(toPublicConnection),
    masterServerIp: store.masterServerIp,
  };
}

/**
 * Looks up a connection by its normalized id and decrypts its password.
 * Returns null when no connection matches; throws when decryption fails.
 */
export async function resolveConnection(connectionId: string): Promise<ResolvedConnection | null> {
  const store = await readMigratedStore();
  const conn = store.connections.find(c => getConnectionId(c) === connectionId);
  if (!conn) return null;
  return { ...conn, password: decryptPassword(conn.password) };
}

/** Every configured connection with its password decrypted. */
export async function resolveAllConnections(): Promise<ResolvedConnection[]> {
  const store = await readMigratedStore();
  return store.connections.map(conn => {
    let password = '';
    try {
      password = decryptPassword(conn.password);
    } catch {
      password = '';
    }
    return { ...conn, password };
  });
}

/** `http://host:port` (or the configured URL) without a trailing slash. */
export function buildBaseUrl(conn: Pick<Connection, 'ip' | 'url' | 'port'>): string {
  if (conn.url && conn.url.length > 0) return conn.url.replace(/\/$/, '');
  if (!conn.ip) throw new Error('Connection has neither url nor ip');
  return `http://${conn.ip}${conn.port ? `:${conn.port}` : ''}`;
}

/** Basic-auth headers for an AdGuard Home request, merged with any extras. */
export function authHeaders(
  conn: Pick<ResolvedConnection, 'username' | 'password'>,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (conn.username && conn.password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${conn.username}:${conn.password}`).toString('base64');
  }
  return headers;
}
