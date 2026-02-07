// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Crypto } from '../crypto.js';

describe('Crypto', () => {
  describe('randomBytes', () => {
    it('should generate random bytes of specified size', () => {
      const bytes = Crypto.randomBytes(16);
      assert.strictEqual(bytes.length, 16);
      // Generate another set and verify they are different
      const bytes2 = Crypto.randomBytes(16);
      assert.notDeepStrictEqual(bytes, bytes2);
    });
  });

  describe('base64Encode and base64Decode', () => {
    it('should encode and decode correctly', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const encoded = Crypto.base64Encode(data);
      const decoded = Crypto.base64Decode(encoded);
      assert.deepStrictEqual(decoded, data);
    });
  });

  describe('aesEncrypt and aesDecrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const data = 'Hello, World!';
      const key = Crypto.randomBytes(32); // 256-bit key
      const iv = Crypto.randomBytes(16); // 128-bit IV

      const encrypted = Crypto.aesEncrypt(data, key, iv);
      const decrypted = Crypto.aesDecrypt(encrypted, key, iv);

      assert.strictEqual(decrypted, data);
    });

    it('should produce different output for same data with different IV', () => {
      const data = 'Hello, World!';
      const key = Crypto.randomBytes(32);
      const iv1 = Crypto.randomBytes(16);
      const iv2 = Crypto.randomBytes(16);

      const encrypted1 = Crypto.aesEncrypt(data, key, iv1);
      const encrypted2 = Crypto.aesEncrypt(data, key, iv2);

      assert.notStrictEqual(encrypted1, encrypted2);
    });
  });

  describe('aesEncryptWithPadding and aesDecryptWithPadding', () => {
    it('should encrypt and decrypt data with PKCS#7 padding', () => {
      const data = 'Hello, World!';
      const key = Crypto.randomBytes(32);
      const iv = Crypto.randomBytes(16);

      const encrypted = Crypto.aesEncryptWithPadding(data, key, iv);
      const decrypted = Crypto.aesDecryptWithPadding(encrypted, key, iv);

      assert.strictEqual(decrypted.toString('utf8'), data);
    });

    it('should handle data that is exactly block size', () => {
      const data = '1234567890123456'; // Exactly 16 bytes
      const key = Crypto.randomBytes(32);
      const iv = Crypto.randomBytes(16);

      const encrypted = Crypto.aesEncryptWithPadding(data, key, iv);
      const decrypted = Crypto.aesDecryptWithPadding(encrypted, key, iv);

      assert.strictEqual(decrypted.toString('utf8'), data);
    });
  });

  describe('pkcs7Pad and pkcs7Unpad', () => {
    it('should pad and unpad correctly', () => {
      const data = 'Hello';
      const blockSize = 16;
      const padded = Crypto.pkcs7Pad(data, blockSize);
      const unpadded = Crypto.pkcs7Unpad(padded);

      assert.strictEqual(unpadded.toString('utf8'), data);
      // Padded length should be multiple of block size
      assert.strictEqual(padded.length % blockSize, 0);
    });

    it('should handle data that is exactly block size', () => {
      const data = '1234567890123456'; // Exactly 16 bytes
      const blockSize = 16;
      const padded = Crypto.pkcs7Pad(data, blockSize);
      const unpadded = Crypto.pkcs7Unpad(padded);

      assert.strictEqual(unpadded.toString('utf8'), data);
      // When data is exactly block size, padding should add a full block
      assert.strictEqual(padded.length, blockSize * 2);
    });
  });

  describe('hmacSha256', () => {
    it('should generate consistent HMAC for same data and key', () => {
      const data = 'Hello, World!';
      const key = Buffer.from('secret-key', 'utf8');

      const hmac1 = Crypto.hmacSha256(data, key);
      const hmac2 = Crypto.hmacSha256(data, key);

      assert.strictEqual(hmac1, hmac2);
    });

    it('should generate different HMAC for different data', () => {
      const data1 = 'Hello, World!';
      const data2 = 'Goodbye, World!';
      const key = Buffer.from('secret-key', 'utf8');

      const hmac1 = Crypto.hmacSha256(data1, key);
      const hmac2 = Crypto.hmacSha256(data2, key);

      assert.notStrictEqual(hmac1, hmac2);
    });

    it('should generate different HMAC for different keys', () => {
      const data = 'Hello, World!';
      const key1 = Buffer.from('secret-key-1', 'utf8');
      const key2 = Buffer.from('secret-key-2', 'utf8');

      const hmac1 = Crypto.hmacSha256(data, key1);
      const hmac2 = Crypto.hmacSha256(data, key2);

      assert.notStrictEqual(hmac1, hmac2);
    });
  });

  describe('rsaEncrypt', () => {
    it('should encrypt data with RSA public key', () => {
      const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkxg2FmN5kY4ZUBaMLJQx
TjCn74YAJE7rRyPEb3uDctUMbUdgVcMBinmgYqe8cF7PbHmuUHYnPNdYkuhPw6WO
WWumCUrE6jioGI8WJG856ATkRifjXh0eEBjn9SLP1h/MfWjcSdGZiqeVt4XcM4u/
Q/R3vdg1UHmsUQX1FZDOl7VBxmKgEzYhpSmXOXumuZeCLC8D1VzDusdeTKdbOw3T
SV7y5ngxduTCjHH1z2D7fYvhL5qN5XCGlDddLhiwpRoHD/KmeKKUTarLZn9ipPYn
GD3pUxqCAtBRzYGCqM/XSW3vh/NjPrTE7OZuSneJ8FNLP8cNYbG4tyfSCm/YI1WC
ZwIDAQAB
-----END PUBLIC KEY-----`

      const data = Buffer.from('Hello, World!', 'utf8');
      const encrypted = Crypto.rsaEncrypt(data, publicKey);

      // Encrypted data should be different from original
      assert.notStrictEqual(encrypted, data.toString('base64'));
      // Encrypted data should be base64 encoded
      assert.doesNotThrow(() => Buffer.from(encrypted, 'base64'));
    });
  });

  describe('integration test - complete encryption flow', () => {
    it('should perform complete encryption/decryption flow', () => {
      // Simulate the login data encryption flow
      const loginData = JSON.stringify({
        reqid: '1234567890123456789012345',
        user: 'testuser',
        password: 'testpass',
      });

      // Generate AES key and IV
      const aesKey = Crypto.randomBytes(32);
      const iv = Crypto.randomBytes(16);

      // Pad the data
      const paddedData = Crypto.pkcs7Pad(loginData);

      // Encrypt with AES
      const encryptedData = Crypto.aesEncryptWithPadding(loginData, aesKey, iv);

      // Decrypt with AES
      const decryptedData = Crypto.aesDecryptWithPadding(encryptedData, aesKey, iv);

      assert.strictEqual(decryptedData.toString('utf8'), loginData);
    });

    it('should perform HMAC calculation flow', () => {
      const secret = Buffer.from('my-secret-key', 'utf8');
      const data = JSON.stringify({ req: 'test', data: 'value' });

      const hmac = Crypto.hmacSha256(data, secret);

      // HMAC should be base64 encoded
      assert.doesNotThrow(() => Buffer.from(hmac, 'base64'));
      // HMAC should be consistent
      const hmac2 = Crypto.hmacSha256(data, secret);
      assert.strictEqual(hmac, hmac2);
    });
  });
});