import crypto from 'crypto';
import CryptoJS from 'crypto-js';

/**
 * Server-side password encryption for stored AdGuard Home credentials.
 *
 * Format v2 (written by this module):
 *   v2:<saltHex>:<ivHex>:<authTagHex>:<cipherTextHex>
 *   AES-256-GCM with a scrypt-derived key. Authenticated, so a wrong key fails
 *   loudly instead of yielding garbage.
 *
 * Legacy format (crypto-js `AES.encrypt(text, passphrase)`) is still accepted so
 * existing `.data/connections.json` files keep working. Those entries are
 * re-encrypted to v2 the first time the store is read.
 *
 * The key MUST NOT be exposed to the browser. `NEXT_PUBLIC_*` is only read as a
 * migration fallback for installs that were configured before the fix, and using
 * it logs a warning.
 */

const V2_PREFIX = 'v2:';
const DEFAULT_KEY = 'adguard-buddy-key';
const SCRYPT_KEYLEN = 32;

let warnedAboutPublicKey = false;
let warnedAboutDefaultKey = false;

/** The key used for all new encryption. */
export function getEncryptionKey(): string {
  const key = process.env.ADGUARD_BUDDY_ENCRYPTION_KEY;
  if (key && key.length > 0) return key;

  const publicKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY;
  if (publicKey && publicKey.length > 0) {
    if (!warnedAboutPublicKey) {
      warnedAboutPublicKey = true;
      console.warn(
        '[adguard-buddy] NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY is deprecated and unsafe ' +
        '(it is embedded in the browser bundle). Rename it to ADGUARD_BUDDY_ENCRYPTION_KEY.'
      );
    }
    return publicKey;
  }

  if (!warnedAboutDefaultKey) {
    warnedAboutDefaultKey = true;
    console.warn(
      '[adguard-buddy] ADGUARD_BUDDY_ENCRYPTION_KEY is not set; falling back to the built-in ' +
      'default key. Set your own key before storing real credentials.'
    );
  }
  return DEFAULT_KEY;
}

/** Keys tried when reading a legacy (crypto-js) ciphertext, best candidate first. */
function legacyKeyCandidates(): string[] {
  const candidates = [
    process.env.ADGUARD_BUDDY_ENCRYPTION_KEY,
    process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY,
    DEFAULT_KEY,
  ].filter((k): k is string => typeof k === 'string' && k.length > 0);
  return [...new Set(candidates)];
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(V2_PREFIX);
}

export function encryptPassword(plaintext: string, key: string = getEncryptionKey()): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const derived = crypto.scryptSync(key, salt, SCRYPT_KEYLEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', derived, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    V2_PREFIX.slice(0, -1),
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function decryptV2(value: string, key: string): string {
  const parts = value.split(':');
  if (parts.length !== 5) throw new Error('Malformed v2 ciphertext');
  const [, saltHex, ivHex, tagHex, dataHex] = parts;
  const derived = crypto.scryptSync(key, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', derived, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

function decryptLegacy(value: string): string {
  const candidates = legacyKeyCandidates();
  for (let i = 0; i < candidates.length; i++) {
    try {
      const plaintext = CryptoJS.AES.decrypt(value, candidates[i]).toString(CryptoJS.enc.Utf8);
      if (plaintext.length > 0) {
        if (i > 0) {
          console.warn(
            '[adguard-buddy] A stored password could only be decrypted with a fallback key. ' +
            'It will be re-encrypted with the configured key on the next write.'
          );
        }
        return plaintext;
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error('Failed to decrypt stored password with any known key');
}

/**
 * Decrypts a stored password. Throws when the value cannot be decrypted so that
 * callers surface a real error instead of authenticating with an empty string.
 */
export function decryptPassword(value: string, key: string = getEncryptionKey()): string {
  if (!value) throw new Error('No stored password');
  if (isEncrypted(value)) return decryptV2(value, key);
  return decryptLegacy(value);
}

/** Decrypts without throwing. Returns null on failure. */
export function tryDecryptPassword(value: string): string | null {
  try {
    return decryptPassword(value);
  } catch {
    return null;
  }
}
