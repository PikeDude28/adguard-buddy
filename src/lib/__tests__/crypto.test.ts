import CryptoJS from 'crypto-js';
import {
  decryptPassword, encryptPassword, getEncryptionKey, isEncrypted, tryDecryptPassword,
} from '../crypto';

describe('crypto', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getEncryptionKey', () => {
    it('prefers the server-only key', () => {
      process.env.ADGUARD_BUDDY_ENCRYPTION_KEY = 'server-key';
      process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY = 'public-key';
      expect(getEncryptionKey()).toBe('server-key');
    });

    it('falls back to the legacy public key for existing installs', () => {
      delete process.env.ADGUARD_BUDDY_ENCRYPTION_KEY;
      process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY = 'public-key';
      expect(getEncryptionKey()).toBe('public-key');
    });

    it('falls back to the built-in default when nothing is configured', () => {
      delete process.env.ADGUARD_BUDDY_ENCRYPTION_KEY;
      delete process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY;
      expect(getEncryptionKey()).toBe('adguard-buddy-key');
    });
  });

  describe('v2 round trip', () => {
    it('encrypts and decrypts a password', () => {
      const cipher = encryptPassword('correct horse battery staple', 'k');
      expect(cipher).not.toContain('correct horse');
      expect(decryptPassword(cipher, 'k')).toBe('correct horse battery staple');
    });

    it('marks its output as encrypted', () => {
      expect(isEncrypted(encryptPassword('x', 'k'))).toBe(true);
      expect(isEncrypted('U2FsdGVkX1+legacy')).toBe(false);
    });

    it('produces a different ciphertext each time', () => {
      expect(encryptPassword('same', 'k')).not.toBe(encryptPassword('same', 'k'));
    });

    it('handles unicode and empty passwords', () => {
      expect(decryptPassword(encryptPassword('pässwörd–✓', 'k'), 'k')).toBe('pässwörd–✓');
      expect(decryptPassword(encryptPassword('', 'k'), 'k')).toBe('');
    });

    it('throws rather than returning garbage for the wrong key', () => {
      const cipher = encryptPassword('secret', 'right-key');
      expect(() => decryptPassword(cipher, 'wrong-key')).toThrow();
    });

    it('throws when the ciphertext was tampered with', () => {
      const cipher = encryptPassword('secret', 'k');
      const parts = cipher.split(':');
      parts[4] = parts[4].replace(/^./, c => (c === 'a' ? 'b' : 'a'));
      expect(() => decryptPassword(parts.join(':'), 'k')).toThrow();
    });

    it('rejects a malformed v2 payload', () => {
      expect(() => decryptPassword('v2:only:three', 'k')).toThrow('Malformed v2 ciphertext');
    });
  });

  describe('legacy crypto-js compatibility', () => {
    it('decrypts a value written by the previous implementation', () => {
      process.env.ADGUARD_BUDDY_ENCRYPTION_KEY = 'legacy-key';
      const legacy = CryptoJS.AES.encrypt('old-password', 'legacy-key').toString();

      expect(isEncrypted(legacy)).toBe(false);
      expect(decryptPassword(legacy)).toBe('old-password');
    });

    it('falls back to the default key for values encrypted before a key was set', () => {
      delete process.env.ADGUARD_BUDDY_ENCRYPTION_KEY;
      delete process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY;
      const legacy = CryptoJS.AES.encrypt('old-password', 'adguard-buddy-key').toString();

      expect(decryptPassword(legacy)).toBe('old-password');
    });

    it('throws when no known key works', () => {
      process.env.ADGUARD_BUDDY_ENCRYPTION_KEY = 'a';
      delete process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY;
      const legacy = CryptoJS.AES.encrypt('old-password', 'completely-different').toString();

      expect(() => decryptPassword(legacy)).toThrow(/Failed to decrypt/);
    });
  });

  describe('tryDecryptPassword', () => {
    it('returns the plaintext on success', () => {
      expect(tryDecryptPassword(encryptPassword('ok'))).toBe('ok');
    });

    it('returns null instead of throwing', () => {
      expect(tryDecryptPassword('not-a-cipher')).toBeNull();
      expect(tryDecryptPassword('')).toBeNull();
    });
  });

  it('throws for an empty stored password', () => {
    expect(() => decryptPassword('')).toThrow('No stored password');
  });
});
