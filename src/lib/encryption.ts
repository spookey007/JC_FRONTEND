// src/lib/encryption.ts

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_WEBSOCKET_ENCRYPTION_KEY || 
  '0000000000000000000000000000000000000000000000000000000000000000'; // 64 hex chars

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

function getKeyBuffer(): Buffer {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 64-character hex string (32 bytes)');
  }
  return key;
}

export async function decryptData(encryptedData: EncryptedData): Promise<any> {
  const isNode = typeof window === 'undefined';

  if (isNode) {
    const { createDecipheriv } = await import('crypto');
    const key = getKeyBuffer();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    const ciphertext = Buffer.from(encryptedData.encrypted, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decipher.final();
    return JSON.parse(decrypted);
  } else {
    const keyBuffer = getKeyBuffer();
    const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBuffer), { name: 'AES-GCM' }, false, ['decrypt']);
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const ciphertext = Buffer.from(encryptedData.encrypted, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');

    const encrypted = new Uint8Array(ciphertext.length + tag.length);
    encrypted.set(ciphertext, 0);
    encrypted.set(tag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}