const crypto = require('crypto');
const config = require('../../config');

// AES-256-GCM: a fresh random IV per encryption, auth tag stored alongside
// so tampering (or picking a wrong key) fails loudly on decrypt instead of
// silently returning garbage that would then get handed to Discord as a
// bot token. TOKEN_ENCRYPTION_KEY is 32 random bytes, base64-encoded (see
// .env.example) -- not the same secret as SESSION_SECRET or the Tebex
// webhook secret, since this one protects other people's bot credentials.

function getKey() {
  if (!config.tokenEncryptionKey) return null;
  const key = Buffer.from(config.tokenEncryptionKey, 'base64');
  return key.length === 32 ? key : null;
}

function isConfigured() {
  return getKey() !== null;
}

// Returns a single string ("iv.tag.ciphertext", all base64) so it stores
// as one TEXT column -- or null if no key is configured, so callers must
// check isConfigured() before trying to store anything sensitive.
function encrypt(plaintext) {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString('base64')).join('.');
}

// Returns null on any failure (wrong/rotated key, corrupted row, not
// configured) rather than throwing -- callers treat null as "this custom
// bot's token can't be read right now," which is the correct, safe
// response to any of those cases.
function decrypt(stored) {
  const key = getKey();
  if (!key || !stored) return null;
  try {
    const [ivB64, tagB64, ciphertextB64] = stored.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { isConfigured, encrypt, decrypt };
