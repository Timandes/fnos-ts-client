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

import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { publicEncrypt, privateDecrypt, constants } from 'crypto';

/**
 * 加密工具类，提供 RSA、AES 和 HMAC 混合加密功能
 */
export class Crypto {
  /**
   * 生成随机字节数组
   * @param size 字节数大小
   * @returns 随机字节数组
   */
  static randomBytes(size: number): Buffer {
    return randomBytes(size);
  }

  /**
   * 使用 RSA 公钥加密数据
   * @param data 要加密的数据
   * @param publicKey PEM 格式的 RSA 公钥
   * @returns Base64 编码的加密数据
   */
  static rsaEncrypt(data: Buffer, publicKey: string): string {
    const encrypted = publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_PADDING,
      },
      data
    );
    return encrypted.toString('base64');
  }

  /**
   * 使用 AES-256-CBC 加密数据
   * @param data 要加密的数据
   * @param key 256位密钥
   * @param iv 16位初始化向量
   * @returns Base64 编码的加密数据
   */
  static aesEncrypt(data: string, key: Buffer, iv: Buffer): string {
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'binary');
    encrypted += cipher.final('binary');
    return Buffer.from(encrypted, 'binary').toString('base64');
  }

  /**
   * 使用 AES-256-CBC 解密数据
   * @param encryptedData Base64 编码的加密数据
   * @param key 256位密钥
   * @param iv 16位初始化向量
   * @returns 解密后的字符串
   */
  static aesDecrypt(encryptedData: string, key: Buffer, iv: Buffer): string {
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * 使用 AES-256-CBC 加密数据（带 PKCS#7 填充）
   * @param data 要加密的数据
   * @param key 256位密钥
   * @param iv 16位初始化向量
   * @returns 加密后的 Buffer
   */
  static aesEncryptWithPadding(data: string, key: Buffer, iv: Buffer): Buffer {
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    return encrypted;
  }

  /**
   * 使用 AES-256-CBC 解密数据（带 PKCS#7 填充移除）
   * @param encryptedData 加密的数据
   * @param key 256位密钥
   * @param iv 16位初始化向量
   * @returns 解密后的 Buffer
   */
  static aesDecryptWithPadding(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted;
  }

  /**
   * 计算 HMAC-SHA256
   * @param data 计算哈希的数据
   * @param key 密钥
   * @returns Base64 编码的 HMAC 结果
   */
  static hmacSha256(data: string, key: Buffer): string {
    const hmac = createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest().toString('base64');
  }

  /**
   * Base64 编码
   * @param data 要编码的数据
   * @returns Base64 编码字符串
   */
  static base64Encode(data: Buffer): string {
    return data.toString('base64');
  }

  /**
   * Base64 解码
   * @param data Base64 编码字符串
   * @returns 解码后的 Buffer
   */
  static base64Decode(data: string): Buffer {
    return Buffer.from(data, 'base64');
  }

  /**
   * 生成 PKCS#7 填充
   * @param data 原始数据
   * @param blockSize 块大小（AES 为 16）
   * @returns 填充后的数据
   */
  static pkcs7Pad(data: string, blockSize: number = 16): Buffer {
    const paddingLength = blockSize - (Buffer.byteLength(data) % blockSize);
    const padding = Buffer.alloc(paddingLength, paddingLength);
    return Buffer.concat([Buffer.from(data, 'utf8'), padding]);
  }

  /**
   * 移除 PKCS#7 填充
   * @param data 带填充的数据
   * @returns 移除填充后的数据
   */
  static pkcs7Unpad(data: Buffer): Buffer {
    const paddingLength = data[data.length - 1];
    return data.subarray(0, data.length - paddingLength);
  }
}