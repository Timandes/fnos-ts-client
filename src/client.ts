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

import WebSocket from 'ws';
import { randomBytes } from 'crypto';
import type { IncomingMessage } from 'node:http';
import { Crypto } from './crypto.js';
import { HTTPSRequiredError, NotConnectedError } from './exceptions.js';
import logger from './logger.js';

export type ConnectionType = 'main' | 'timer' | 'file';

interface PendingRequest {
  future: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  };
  req: string;
  payload: any;
  timeoutTimer: NodeJS.Timeout | null;
}

interface MessageCallback {
  (message: string): void;
}

export interface LoginResponse {
  result: 'succ' | 'fail';
  token?: string;
  longToken?: string;
  secret?: string;
  msg?: string;
  errmsg?: string;
  reqid?: string;
  accessToken?: string;
  secureEmail?: string;
  isTwofaEnforced?: boolean;
  isBindTwofaSecret?: boolean;
  isTrustedDevice?: boolean;
  twofaRequired?: boolean;
  twofaSetupRequired?: boolean;
  [key: string]: unknown;
}

interface TwofaPending {
  accessToken: string;
  username: string;
  stay: boolean;
  deviceType: string;
  deviceName: string;
}

export class FnosClient {
  private type: ConnectionType;
  private ws: WebSocket | null = null;
  private publicKey: string | null = null;
  private hostName: string | null = null;
  private trimVersion: string | null = null;
  private sessionId: string | null = null;
  private connected = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stopHeartbeat = false;
  private connectTimeoutTimer: NodeJS.Timeout | null = null;
  private loginResponse: LoginResponse | null = null;
  private loginResolve: ((value: LoginResponse) => void) | null = null;
  private loginReject: ((reason?: any) => void) | null = null;
  private loginReqid: string | null = null;
  private loginTimeoutTimer: NodeJS.Timeout | null = null;
  private twofaPending: TwofaPending | null = null;
  private twofaReqid: string | null = null;
  private twofaResolve: ((value: LoginResponse) => void) | null = null;
  private twofaReject: ((reason?: unknown) => void) | null = null;
  private twofaTimeoutTimer: NodeJS.Timeout | null = null;
  private loginContext: Omit<TwofaPending, 'accessToken'> | null = null;
  private decryptedSecret: string | null = null;
  private aesKey: Buffer | null = null;
  private iv: Buffer | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private onMessageCallback: MessageCallback | null = null;
  private connectResolve: ((value: boolean) => void) | null = null;
  private connectReject: ((reason?: any) => void) | null = null;

  // 保存连接和登录信息用于重连
  private endpoint: string | null = null;
  private username: string | null = null;
  private password: string | null = null;
  private token: string | null = null;
  private longToken: string | null = null;

  // SSL 配置
  private useSsl = false;
  private skipSslVerify = true;

  constructor(type: ConnectionType = 'main') {
    if (type !== 'main' && type !== 'timer' && type !== 'file') {
      throw new Error("type参数必须是'main'、'timer'或'file'");
    }
    this.type = type;
  }

  /**
   * 生成唯一的 reqid
   */
  private generateReqid(): string {
    const timestamp = Date.now(); // 毫秒级时间戳 (13位数字)
    const randomPart = randomBytes(6).toString('hex'); // 12位随机字符串
    // 格式化为指定格式: timestamp + random_part，总长度不超过28
    return `${timestamp}${randomPart}`;
  }

  /**
   * 生成设备ID
   */
  private generateDid(): string {
    const t = Buffer.from(Date.now().toString()).toString('base64').replace(/=/g, '');
    const e = Buffer.from(Math.random().toString()).toString('base64').slice(0, 15).replace(/=/g, '');
    const n = Buffer.from(Math.random().toString()).toString('base64').slice(0, 15).replace(/=/g, '');
    return `${t}-${e}-${n}`.toLowerCase();
  }

  private encryptAuthData(payload: Record<string, unknown>): Record<string, string> {
    if (!this.publicKey || !this.sessionId) {
      throw new Error('未获取到公钥或会话ID');
    }

    this.aesKey = Crypto.randomBytes(32); // 256位密钥
    const encryptedAesKey = Crypto.rsaEncrypt(this.aesKey, this.publicKey);
    this.iv = Crypto.randomBytes(16);
    const encryptedData = Crypto.aesEncryptWithPadding(
      JSON.stringify(payload),
      this.aesKey,
      this.iv,
    );
    return {
      req: 'encrypted',
      iv: Crypto.base64Encode(this.iv),
      rsa: encryptedAesKey,
      aes: Crypto.base64Encode(encryptedData),
    };
  }

  /**
   * 加密登录数据
   */
  private encryptLoginData(
    username: string,
    password: string,
    stay = true,
    deviceType = 'Browser',
    deviceName = 'Mac OS-Safari',
  ): Record<string, string> {
    const reqid = this.generateReqid();
    this.loginReqid = reqid;
    return this.encryptAuthData({
      reqid,
      user: username,
      password,
      stay,
      deviceType,
      deviceName,
      did: this.generateDid(),
      req: 'user.login',
      si: this.sessionId,
    });
  }

  /**
   * 解密登录响应中的secret字段
   */
  private decryptLoginSecret(encryptedSecret: string): string | null {
    if (!this.aesKey || !this.iv) {
      return null;
    }

    try {
      const rawSecret = Crypto.base64Decode(encryptedSecret);
      const rawDecryptedSecret = Crypto.aesDecryptWithPadding(rawSecret, this.aesKey, this.iv);
      return Crypto.base64Encode(rawDecryptedSecret);
    } catch (e) {
      logger.error(`解密登录secret失败: ${e}`);
      return null;
    }
  }

  private isFinalLoginSuccess(data: LoginResponse): boolean {
    return data.result === 'succ' &&
      typeof data.token === 'string' &&
      typeof data.secret === 'string';
  }

  private isTwofaChallenge(data: LoginResponse): boolean {
    return data.result === 'succ' &&
      data.isBindTwofaSecret === true &&
      data.isTrustedDevice === false &&
      typeof data.accessToken === 'string' &&
      !data.token &&
      !data.secret;
  }

  private isTwofaSetupChallenge(data: LoginResponse): boolean {
    return data.result === 'succ' &&
      data.isTwofaEnforced === true &&
      data.isBindTwofaSecret === false &&
      typeof data.accessToken === 'string' &&
      !data.token &&
      !data.secret;
  }

  private clearTwofaAttempt(): void {
    if (this.twofaTimeoutTimer) {
      clearTimeout(this.twofaTimeoutTimer);
    }
    this.twofaTimeoutTimer = null;
    this.twofaReqid = null;
    this.twofaResolve = null;
    this.twofaReject = null;
  }

  private clearTwofaState(): void {
    this.clearTwofaAttempt();
    this.twofaPending = null;
  }

  private handleFinalLoginSuccess(data: LoginResponse): void {
    this.loginResponse = data;
    this.decryptedSecret = this.decryptLoginSecret(data.secret!);
    this.token = data.token ?? null;
    this.longToken = data.longToken ?? null;
  }

  /**
   * 解析 endpoint，返回 { hostPort, actualUseSsl }
   *
   * - 如果 endpoint 以 wss:// 开头，返回去掉前缀的地址和 true
   * - 如果 endpoint 以 ws:// 开头，返回去掉前缀的地址和 false
   * - 否则返回原地址和 useSsl 参数值
   */
  private parseEndpoint(endpoint: string, useSsl: boolean): { hostPort: string; actualUseSsl: boolean } {
    if (endpoint.startsWith('wss://')) {
      return { hostPort: endpoint.slice(6), actualUseSsl: true };
    } else if (endpoint.startsWith('ws://')) {
      return { hostPort: endpoint.slice(5), actualUseSsl: false };
    }
    return { hostPort: endpoint, actualUseSsl: useSsl };
  }

  private httpsRequiredError(
    requestedUri: string,
    actualUseSsl: boolean,
    response: IncomingMessage,
  ): HTTPSRequiredError | null {
    const statusCode = response.statusCode;
    const location = response.headers.location;
    if (
      actualUseSsl ||
      !statusCode ||
      ![301, 302, 303, 307, 308].includes(statusCode) ||
      !location
    ) {
      return null;
    }

    let redirect: URL;
    try {
      redirect = new URL(location, requestedUri);
    } catch {
      return null;
    }
    if (redirect.protocol !== 'https:') {
      return null;
    }
    return new HTTPSRequiredError(requestedUri, redirect.toString(), statusCode);
  }

  /**
   * 连接到WebSocket服务器
   *
   * @param endpoint 服务器地址，可以是 "host:port" 格式或带协议前缀 "ws://host:port" / "wss://host:port"
   * @param timeout 连接超时时间（毫秒）
   * @param useSsl 是否使用 SSL/WSS 连接（默认 false）
   * @param skipSslVerify 是否跳过 SSL 证书验证（默认 true）
   */
  connect(endpoint: string, timeout: number = 3000, useSsl: boolean = false, skipSslVerify: boolean = true): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 解析 endpoint，处理协议前缀
      const { hostPort, actualUseSsl } = this.parseEndpoint(endpoint, useSsl);

      // 保存连接信息用于重连
      this.endpoint = hostPort;
      this.useSsl = actualUseSsl;
      this.skipSslVerify = skipSslVerify;

      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        // 根据 useSsl 选择协议
        const protocol = actualUseSsl ? 'wss' : 'ws';
        const uri = `${protocol}://${hostPort}/websocket?type=${this.type}`;

        // 配置 SSL 选项
        const wsOptions: WebSocket.ClientOptions = actualUseSsl ? {
          rejectUnauthorized: !skipSslVerify,
        } : {};

        // 创建WebSocket连接
        this.ws = new WebSocket(uri, wsOptions);

        this.ws.on('unexpected-response', (_request, response) => {
          const converted = this.httpsRequiredError(uri, actualUseSsl, response);
          const error = converted ?? new Error(
            `Unexpected server response: ${response.statusCode ?? 'unknown'}`,
          );
          response.resume();
          if (this.connectTimeoutTimer) {
            clearTimeout(this.connectTimeoutTimer);
          }
          this.connectTimeoutTimer = null;
          this.connected = false;
          this.ws = null;
          const rejectConnect = this.connectReject;
          this.connectReject = null;
          this.connectResolve = null;
          rejectConnect?.(error);
        });

        // 设置超时
        this.connectTimeoutTimer = setTimeout(() => {
          if (this.connectReject) {
            this.connectReject(new Error('连接超时'));
            this.connectReject = null;
          }
          this.connected = false;
          if (this.ws) {
            try {
              this.ws.close();
            } catch (e) {
              logger.error(`关闭 WebSocket 失败: ${e}`);
            }
            this.ws = null;  // 清理引用
          }
          this.stopHeartbeat = true;
          if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
          }
        }, timeout);

        this.ws.on('open', () => {
          logger.info('WebSocket连接已建立');
          // 发送第一个请求获取RSA公钥
          this.sendFirstRequest();
        });

        this.ws.on('message', (data: Buffer) => {
          const message = data.toString('utf8');
          // 首先调用外部回调函数（如果存在）
          if (this.onMessageCallback) {
            try {
              this.onMessageCallback(message);
            } catch (e) {
              logger.warn(`外部消息回调函数出错: ${e}`);
            }
          }
          this.processMessage(message);
        });

        this.ws.on('close', () => {
          logger.info('WebSocket连接已关闭');
          this.handleDisconnection();
        });

        this.ws.on('error', (error: Error) => {
          logger.error(`WebSocket错误: ${error.message}`);
          this.connected = false;
          if (this.connectTimeoutTimer) {
            clearTimeout(this.connectTimeoutTimer);
            this.connectTimeoutTimer = null;
          }
          if (this.connectReject) {
            this.connectReject(error);
            this.connectReject = null;
          }
          this.handleDisconnection();
        });
      } catch (e) {
            logger.error(`连接失败: ${e}`);
            this.connected = false;
            if (this.connectReject) {
              this.connectReject(e);
            }
          }    });
  }

  /**
   * 处理接收到的消息
   */
  private processMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      if ('pub' in data && 'reqid' in data) {
        // 这是第一个请求的响应（获取RSA公钥）
        this.publicKey = data.pub;
        this.sessionId = data.si;
        logger.debug(`已获取RSA公钥`);
        logger.debug(`会话ID: ${data.si}`);
        // 设置连接状态为已连接
        this.connected = true;
        logger.info('WebSocket连接已建立');
        // 发送第二个请求（等待第二个请求响应后再完成Promise）
        this.sendSecondRequest();
      } else if ('data' in data && 'hostName' in data.data) {
        // 这是第二个请求的响应（获取主机名）
        this.hostName = data.data.hostName;
        this.trimVersion = data.data.trimVersion;
        logger.debug(`主机名: ${this.hostName}`);
        logger.debug(`Trim版本: ${this.trimVersion}`);
        // 启动心跳机制
        this.startHeartbeat();
        // 设置连接future完成（在心跳启动后）
        if (this.connectResolve) {
          this.connectResolve(true);
          this.connectResolve = null;
        }
        // 清除连接超时定时器
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
      } else if ('res' in data && data.res === 'pong') {
        // 这是心跳响应
        logger.debug('收到心跳响应: pong');
      } else if (this.isFinalLoginSuccess(data)) {
        const resolveTwofa = data.reqid === this.twofaReqid ? this.twofaResolve : null;
        this.handleFinalLoginSuccess(data);
        if (this.loginTimeoutTimer) {
          clearTimeout(this.loginTimeoutTimer);
        }
        this.loginTimeoutTimer = null;
        this.loginReqid = null;
        this.clearTwofaState();
        if (resolveTwofa) {
          resolveTwofa(data);
        } else if (this.loginResolve) {
          this.loginResolve(data);
        }
        this.loginResolve = null;
        this.loginReject = null;
        logger.debug(`服务器返回的secret: ${this.decryptedSecret?.substring(0, 20)}...`);
        logger.info('登录成功');
      } else if (this.isTwofaChallenge(data) || this.isTwofaSetupChallenge(data)) {
        const isBoundChallenge = this.isTwofaChallenge(data);
        const context = this.loginContext;
        if (!context) {
          throw new Error('缺少登录上下文');
        }
        this.twofaPending = {
          accessToken: data.accessToken!,
          username: context.username,
          stay: context.stay,
          deviceType: context.deviceType,
          deviceName: context.deviceName,
        };
        const challengeResponse: LoginResponse = {
          ...data,
          twofaRequired: isBoundChallenge,
          twofaSetupRequired: !isBoundChallenge,
        };
        this.loginResponse = challengeResponse;
        if (this.loginTimeoutTimer) {
          clearTimeout(this.loginTimeoutTimer);
        }
        this.loginTimeoutTimer = null;
        this.loginReqid = null;
        this.loginResolve?.(challengeResponse);
        this.loginResolve = null;
        this.loginReject = null;
      } else if (
        data.result === 'fail' &&
        typeof data.reqid === 'string' &&
        data.reqid === this.twofaReqid
      ) {
        const resolveFailure = this.twofaResolve;
        this.clearTwofaAttempt();
        resolveFailure?.(data);
        logger.error(`两步验证失败: ${data.msg || data.errmsg || '未知错误'}`);
      } else if ('result' in data && data.result === 'fail' && this.loginReqid && 'reqid' in data && data.reqid === this.loginReqid) {
        // 登录失败
        this.loginResponse = data;
        // 清除登录超时定时器
        if (this.loginTimeoutTimer) {
          clearTimeout(this.loginTimeoutTimer);
          this.loginTimeoutTimer = null;
        }
        if (this.loginReject) {
          this.loginReject(new Error(data.msg || data.errmsg || '未知错误'));
          this.loginReject = null;
        }
        this.loginResolve = null;
        this.loginReqid = null;
        logger.error(`登录失败: ${data.msg || data.errmsg || '未知错误'}`);
      } else {
        // 检查消息中是否包含reqid，这可能是待处理请求的响应
        if ('reqid' in data) {
          const reqid = data.reqid as string;
          const pending = this.pendingRequests.get(reqid);
          if (pending) {
            // 清除超时定时器
            if (pending.timeoutTimer) {
              clearTimeout(pending.timeoutTimer);
              pending.timeoutTimer = null;
            }
            this.pendingRequests.delete(reqid);
            pending.future.resolve(data);
            logger.debug(`收到待处理请求的响应: ${reqid}`);
          } else {
            logger.warn(`收到未知请求ID的响应: ${reqid}`);
          }
        } else {
          logger.warn(`收到未知消息: ${message}`);
        }
      }
    } catch (e) {
      // 如果不是JSON格式，检查是否有待处理的请求在等待这个响应
      for (const [reqId, reqData] of this.pendingRequests.entries()) {
        reqData.future.resolve(message);
        this.pendingRequests.delete(reqId);
        break;
      }
      logger.error(`无法解析消息: ${message}`);
    }
  }

  /**
   * 发送消息到服务器
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageJson = JSON.stringify(message);
      logger.debug(`Sending message: ${messageJson}`);
      this.ws.send(messageJson);
    }
  }

  /**
   * 发送第一个请求获取RSA公钥
   */
  private sendFirstRequest(): void {
    const reqid = this.generateReqid();
    const message = {
      reqid: reqid,
      req: 'util.crypto.getRSAPub',
    };
    this.sendMessage(message);
  }

  /**
   * 发送第二个请求获取主机名
   */
  private sendSecondRequest(): void {
    const reqid = this.generateReqid();
    const message = {
      reqid: reqid,
      req: 'appcgi.sysinfo.getHostName',
    };
    this.sendMessage(message);
  }

  /**
   * 启动心跳机制
   */
  private startHeartbeat(): void {
    this.stopHeartbeat = false;

    // 立即发送第一个心跳包
    const sendHeartbeat = () => {
      if (!this.stopHeartbeat && this.isConnected()) {
        const message = {
          req: 'ping',
        };
        try {
          this.sendMessage(message);
          logger.debug('已发送心跳请求');
        } catch (e) {
          logger.error(`发送心跳失败: ${e}`);
          // 心跳发送失败，可能连接已断开
          this.handleDisconnection();
        }
      }
    };

    // 立即发送第一个心跳
    sendHeartbeat();

    // 然后每30秒发送一次
    this.heartbeatTimer = setInterval(sendHeartbeat, 30000);
  }

  /**
   * 用户登录方法
   */
  login(
    username: string,
    password: string,
    timeout: number = 10000,
    stay = true,
    deviceType = 'Browser',
    deviceName = 'Mac OS-Safari',
  ): Promise<LoginResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new NotConnectedError('未连接到服务器'));
        return;
      }

      if (!this.publicKey || !this.sessionId) {
        reject(new Error('未获取到公钥或会话ID'));
        return;
      }

      // 保存用户名和密码用于重连
      this.username = username;
      this.password = password;
      this.loginContext = {
        username,
        stay,
        deviceType,
        deviceName,
      };

      // 加密登录数据
      const encryptedData = this.encryptLoginData(
        username,
        password,
        stay,
        deviceType,
        deviceName,
      );

      // 发送登录请求并等待响应
      this.loginResolve = resolve;
      this.loginReject = reject;
      logger.debug('Sending login request');
      this.sendMessage(encryptedData);

      // 设置超时
      this.loginTimeoutTimer = setTimeout(() => {
        this.loginReqid = null;
        if (this.loginReject) {
          this.loginReject(new Error('登录超时'));
          this.loginReject = null;
        }
        this.loginTimeoutTimer = null;
      }, timeout);
    });
  }

  /**
   * 提交两步验证码完成登录
   */
  submitTwofaCode(
    code: string,
    trustDevice = false,
    timeout = 10000,
  ): Promise<LoginResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new NotConnectedError('未连接到服务器'));
        return;
      }
      if (!this.publicKey || !this.sessionId) {
        reject(new Error('未获取到公钥或会话ID'));
        return;
      }
      if (!this.twofaPending) {
        reject(new Error('没有待完成的两步验证登录'));
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        reject(new RangeError('两步验证码必须是6位数字'));
        return;
      }

      const reqid = this.generateReqid();
      this.twofaReqid = reqid;
      this.twofaResolve = resolve;
      this.twofaReject = reject;
      const pending = this.twofaPending;
      const encrypted = this.encryptAuthData({
        reqid,
        code,
        isTrustedDevice: trustDevice,
        accessToken: pending.accessToken,
        stay: pending.stay ? 1 : 0,
        deviceName: pending.deviceName,
        deviceType: pending.deviceType,
        did: this.generateDid(),
        req: 'user.2fa.loginVerify',
        si: this.sessionId,
      });
      this.sendMessage(encrypted);
      this.twofaTimeoutTimer = setTimeout(() => {
        const timeoutReject = this.twofaReject;
        this.clearTwofaAttempt();
        timeoutReject?.(new Error('两步验证超时'));
      }, timeout);
    });
  }

  /**
   * 使用token登录方法
   */
  async loginViaToken(token: string, longToken: string, secret: string, timeout: number = 10000): Promise<any> {
    if (!this.connected) {
      throw new NotConnectedError('未连接到服务器');
    }

    if (!this.publicKey || !this.sessionId) {
      throw new Error('未获取到公钥或会话ID');
    }

    // 保存 token 用于重连
    this.token = token;
    this.longToken = longToken;
    this.decryptedSecret = secret;

    // 使用 token 登录
    const payload = { main: true, token: token, si: this.sessionId };
    const response = await this.requestPayloadWithResponse('user.authToken', payload, timeout);

    // 登录失败，使用 long_token 登录
    if (response.errno === 135168) {
      logger.info('使用 long_token 登录');
      const payload2 = {
        deviceType: 'Browser',
        deviceName: 'Mac OS-Safari',
        did: this.generateDid(),
        si: this.sessionId,
        token: this.longToken,
      };
      const response2 = await this.requestPayloadWithResponse('user.tokenLogin', payload2, timeout);
      if (response2.token) {
        this.token = response2.token;
      }
      return response2;
    }
    return response;
  }

  /**
   * 获取解密后的secret
   */
  getDecryptedSecret(): string | null {
    return this.decryptedSecret;
  }

  /**
   * 设置消息回调函数
   */
  onMessage(callback: MessageCallback): void {
    this.onMessageCallback = callback;
  }

  /**
   * 实现HMAC-SHA256加密函数
   */
  private iz(data: string): string {
    if (!this.decryptedSecret) {
      throw new Error('未获取到secret');
    }

    // 解码base64格式的secret
    const key = Crypto.base64Decode(this.decryptedSecret);

    // 计算HMAC-SHA256
    const hmacResult = Crypto.hmacSha256(data, key);

    return hmacResult;
  }

  /**
   * 发送请求
   */
  async request(e: string): Promise<void> {
    if (!this.connected) {
      throw new NotConnectedError('未连接到服务器');
    }

    if (!this.decryptedSecret) {
      throw new Error('未获取到secret');
    }

    // 计算iz(e) + e
    logger.debug(`Sending msg: ${e}`);
    const izResult = this.iz(e);
    logger.debug(`Calculated iz-result: ${izResult}`);
    const requestData = izResult + e;
    logger.debug(`Sending msg to channel: ${requestData}`);

    // 发送数据
    if (this.ws) {
      this.ws.send(requestData);
      logger.debug(`已发送请求: ${requestData}`);
    }
  }

  /**
   * 以payload为主体，添加req和reqid后发送请求
   */
  async requestPayload(req: string, payload: any): Promise<string> {
    if (!this.connected) {
      throw new NotConnectedError('未连接到服务器');
    }

    // 将req以key=req放进去
    const payloadData = { ...payload };
    payloadData.req = req;

    // 生成请求ID以key="reqid"放进去
    const reqid = this.generateReqid();
    payloadData.reqid = reqid;

    // JSON序列化之后访问request()方法完成发送
    const jsonData = JSON.stringify(payloadData);
    await this.request(jsonData);

    return reqid;
  }

  /**
   * 以payload为主体，添加req和reqid后发送请求，并返回响应
   */
  requestPayloadWithResponse(req: string, payload: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new NotConnectedError('未连接到服务器'));
        return;
      }

      // 创建一个Future对象来等待响应
      const future = {
        resolve: resolve,
        reject: reject,
      };

      // 将请求添加到待处理请求列表
      const reqid = this.generateReqid();
      let timeoutTimer: NodeJS.Timeout | null = null;
      this.pendingRequests.set(reqid, {
        future: future,
        req: req,
        payload: payload,
        timeoutTimer: null, // 将在下面设置
      });

      // 构造请求数据
      const payloadData = { ...payload };
      payloadData.req = req;
      payloadData.reqid = reqid;

      // JSON序列化之后访问request()方法完成发送
      const jsonData = JSON.stringify(payloadData);
      this.request(jsonData).catch((e) => {
        this.pendingRequests.delete(reqid);
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        reject(e);
      });

      // 设置超时
      timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(reqid);
        reject(new Error(`请求 ${req} 超时`));
      }, timeout);

      // 保存定时器引用到 pendingRequests 中
      const pending = this.pendingRequests.get(reqid);
      if (pending) {
        pending.timeoutTimer = timeoutTimer;
      }
    });
  }

  /**
   * 重连方法
   */
  async reconnect(connectTimeout: number = 3000, loginTimeout: number = 10000): Promise<boolean> {
    if (this.connected) {
      logger.info('已经连接，无需重连');
      return true;
    }

    if (!this.endpoint) {
      throw new Error('没有保存的endpoint用于重连');
    }

    if (!this.username || !this.password) {
      throw new Error('没有保存的用户名和密码用于重连');
    }

    logger.info('开始重连...');

    // 先连接（使用保存的 SSL 配置）
    await this.connect(this.endpoint!, connectTimeout, this.useSsl, this.skipSslVerify);

    // 再登录
    const loginResult = await this.login(this.username, this.password, loginTimeout);

    if (loginResult?.result === 'succ') {
      logger.info('重连成功');
      return true;
    } else {
      throw new Error('重连失败：登录失败');
    }
  }

  /**
   * 关闭WebSocket连接
   */
  close(): void {
    const rejectTwofa = this.twofaReject;
    this.clearTwofaState();
    rejectTwofa?.(new Error('连接已关闭'));
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        logger.error(`关闭 WebSocket 失败: ${e}`);
      }
      this.ws = null;
    }
    this.connected = false;
    this.stopHeartbeat = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.loginTimeoutTimer) {
      clearTimeout(this.loginTimeoutTimer);
      this.loginTimeoutTimer = null;
    }
    // 清理所有待处理的请求，防止 Promise 无法 resolve/reject 导致程序无法退出
    for (const [reqid, pending] of this.pendingRequests.entries()) {
      // 清除超时定时器
      if (pending.timeoutTimer) {
        clearTimeout(pending.timeoutTimer);
        pending.timeoutTimer = null;
      }
      pending.future.reject(new Error('连接已关闭'));
    }
    this.pendingRequests.clear();
  }

  /**
   * 获取连接状态
   * 检查连接标志和 WebSocket 实际状态，确保返回准确的连接状态
   */
  isConnected(): boolean {
    return this.connected &&
           this.ws !== null &&
           this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 处理连接断开
   * 统一清理资源，更新连接状态
   */
  private handleDisconnection(): void {
    this.connected = false;
    this.stopHeartbeat = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
