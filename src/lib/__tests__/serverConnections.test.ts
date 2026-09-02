import { promises as fs } from 'fs';
import { encryptPassword, isEncrypted } from '../crypto';
import {
  authHeaders, buildBaseUrl, getPublicStore, migrateStore, readMigratedStore,
  readStore, resolveAllConnections, resolveConnection, toPublicConnection, writeStore,
} from '../serverConnections';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

const notFound = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

describe('serverConnections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.stat.mockResolvedValue({} as never);
    mockFs.writeFile.mockResolvedValue(undefined);
    process.env.ADGUARD_BUDDY_ENCRYPTION_KEY = 'test-key';
  });

  describe('readStore', () => {
    it('returns an empty store when the file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(notFound());
      expect(await readStore()).toEqual({ connections: [], masterServerIp: null });
    });

    it('normalizes a store missing its fields', async () => {
      mockFs.readFile.mockResolvedValue('{}');
      expect(await readStore()).toEqual({ connections: [], masterServerIp: null });
    });

    it('propagates other read errors', async () => {
      mockFs.readFile.mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
      await expect(readStore()).rejects.toThrow('EACCES');
    });

    it('propagates malformed JSON', async () => {
      mockFs.readFile.mockResolvedValue('{ not json');
      await expect(readStore()).rejects.toThrow(SyntaxError);
    });
  });

  describe('migrateStore', () => {
    it('normalizes a legacy master id stored as a bare ip', () => {
      const { store, migrated } = migrateStore({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: encryptPassword('p') }],
        masterServerIp: '10.0.0.1',
      });

      expect(migrated).toBe(true);
      expect(store.masterServerIp).toBe('10.0.0.1:80');
    });

    it('re-encrypts a legacy password into the v2 format', () => {
      const CryptoJS = require('crypto-js');
      const legacy = CryptoJS.AES.encrypt('old-pw', 'test-key').toString();

      const { store, migrated } = migrateStore({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: legacy }],
        masterServerIp: null,
      });

      expect(migrated).toBe(true);
      expect(isEncrypted(store.connections[0].password)).toBe(true);
    });

    it('leaves an undecryptable password alone rather than losing it', () => {
      const { store, migrated } = migrateStore({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: 'garbage' }],
        masterServerIp: null,
      });

      expect(migrated).toBe(false);
      expect(store.connections[0].password).toBe('garbage');
    });

    it('reports no migration for an already-current store', () => {
      const { migrated } = migrateStore({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: encryptPassword('p') }],
        masterServerIp: '10.0.0.1:80',
      });

      expect(migrated).toBe(false);
    });
  });

  describe('readMigratedStore', () => {
    it('persists a migration it performed', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: encryptPassword('p') }],
        masterServerIp: '10.0.0.1',
      }));

      const store = await readMigratedStore();

      expect(store.masterServerIp).toBe('10.0.0.1:80');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('still returns the migrated view when persisting fails', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: encryptPassword('p') }],
        masterServerIp: '10.0.0.1',
      }));
      mockFs.writeFile.mockRejectedValue(new Error('read-only'));

      await expect(readMigratedStore()).resolves.toMatchObject({ masterServerIp: '10.0.0.1:80' });
    });
  });

  describe('public view', () => {
    it('drops the password field', () => {
      const publicConn = toPublicConnection({
        ip: '10.0.0.1', port: 80, username: 'admin', password: 'v2:secret', color: '#fff',
      });

      expect(publicConn).not.toHaveProperty('password');
      expect(publicConn.id).toBe('10.0.0.1:80');
      expect(publicConn.color).toBe('#fff');
    });

    it('exposes no credential material through getPublicStore', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'admin', password: encryptPassword('hunter2') }],
        masterServerIp: null,
      }));

      const store = await getPublicStore();

      expect(JSON.stringify(store)).not.toContain('hunter2');
      expect(JSON.stringify(store)).not.toContain('password');
    });
  });

  describe('resolveConnection', () => {
    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        connections: [
          { ip: '10.0.0.1', port: 80, username: 'admin', password: encryptPassword('pw-one') },
          { url: 'https://dns.test', username: 'admin', password: encryptPassword('pw-two') },
        ],
        masterServerIp: null,
      }));
    });

    it('returns the connection with a decrypted password', async () => {
      const conn = await resolveConnection('10.0.0.1:80');
      expect(conn?.password).toBe('pw-one');
    });

    it('matches a URL connection by its normalized id', async () => {
      const conn = await resolveConnection('https://dns.test');
      expect(conn?.password).toBe('pw-two');
    });

    it('returns null for an unknown id', async () => {
      expect(await resolveConnection('192.0.2.1:80')).toBeNull();
    });

    it('throws when the stored password cannot be decrypted', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        connections: [{ ip: '10.0.0.1', port: 80, username: 'a', password: 'v2:bad:bad:bad:bad' }],
        masterServerIp: null,
      }));

      await expect(resolveConnection('10.0.0.1:80')).rejects.toThrow();
    });
  });

  describe('resolveAllConnections', () => {
    it('yields an empty password rather than throwing for a broken entry', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        connections: [
          { ip: '10.0.0.1', port: 80, username: 'a', password: encryptPassword('good') },
          { ip: '10.0.0.2', port: 80, username: 'b', password: 'garbage' },
        ],
        masterServerIp: null,
      }));

      const all = await resolveAllConnections();

      expect(all[0].password).toBe('good');
      expect(all[1].password).toBe('');
    });
  });

  describe('buildBaseUrl', () => {
    it('prefers a URL and strips the trailing slash', () => {
      expect(buildBaseUrl({ url: 'https://dns.test/', ip: '10.0.0.1', port: 80 })).toBe('https://dns.test');
    });

    it('builds host:port from an ip', () => {
      expect(buildBaseUrl({ ip: '10.0.0.1', port: 8080 })).toBe('http://10.0.0.1:8080');
    });

    it('omits the port when there is none', () => {
      expect(buildBaseUrl({ ip: '10.0.0.1' })).toBe('http://10.0.0.1');
    });

    it('throws when there is nothing to address', () => {
      expect(() => buildBaseUrl({})).toThrow('neither url nor ip');
    });
  });

  describe('authHeaders', () => {
    it('adds basic auth and keeps extra headers', () => {
      const headers = authHeaders({ username: 'admin', password: 'pw' }, { 'Content-Type': 'application/json' });

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers.Authorization).toBe('Basic ' + Buffer.from('admin:pw').toString('base64'));
    });

    it('omits Authorization when credentials are incomplete', () => {
      expect(authHeaders({ username: 'admin', password: '' })).not.toHaveProperty('Authorization');
      expect(authHeaders({ username: '', password: 'pw' })).not.toHaveProperty('Authorization');
    });
  });

  describe('writeStore', () => {
    it('creates the data directory when it is missing', async () => {
      mockFs.stat.mockRejectedValue(notFound());

      await writeStore({ connections: [], masterServerIp: null });

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.data'), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });
});
