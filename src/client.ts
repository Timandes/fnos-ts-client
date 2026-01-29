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
import { Crypto } from './crypto.js';
import { NotConnectedError } from './exceptions.js';

export type ConnectionType = 'main' | 'timer' | 'file';

interface PendingRequest {
  future: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  };
  req: string;
  payload: any;
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
  reqid?: string;
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
  private loginResponse: LoginResponse | null = null;
  private loginResolve: ((value: LoginResponse) => void) | null = null;
  private loginReject: ((reason?: any) => void) | null = null;
  private loginReqid: string | null = null;
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

  /**
   * 加密登录数据
   */
  private encryptLoginData(username: string, password: string): any {
    if (!this.publicKey || !this.sessionId) {
      throw new Error('未获取到公钥或会话ID');
    }

    // 生成随机AES密钥
    this.aesKey = Crypto.randomBytes(32); // 256位密钥

    // 使用RSA公钥加密AES密钥
    const encryptedAesKey = Crypto.rsaEncrypt(this.aesKey, this.publicKey);

    // 构造登录数据
    const loginData = {
      reqid: this.generateReqid(),
      user: username,
      password: password,
      stay: true,
      deviceType: 'Browser',
      deviceName: 'Mac OS-Safari',
      did: this.generateDid(),
      req: 'user.login',
      si: this.sessionId,
    };

    // 保存登录请求的reqid
    this.loginReqid = loginData.reqid;

    // 使用AES密钥加密登录数据
    const jsonData = JSON.stringify(loginData);
    this.iv = Crypto.randomBytes(16);
    const encryptedData = Crypto.aesEncryptWithPadding(jsonData, this.aesKey, this.iv);

    // 构造返回数据
    return {
      req: 'encrypted',
      iv: Crypto.base64Encode(this.iv),
      rsa: encryptedAesKey,
      aes: Crypto.base64Encode(encryptedData),
    };
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
      console.error(`解密登录secret失败: ${e}`);
      return null;
    }
  }

  /**
   * 连接到WebSocket服务器
   */
  connect(endpoint: string, timeout: number = 3000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.endpoint = endpoint;
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        // 创建WebSocket连接
        this.ws = new WebSocket(`ws://${endpoint}/websocket?type=${this.type}`);

        // 设置超时
        const timeoutTimer = setTimeout(() => {
          if (this.connectReject) {
            this.connectReject(new Error('连接超时'));
          }
          this.connected = false;
          if (this.ws) {
            this.ws.close();
          }
        }, timeout);

        this.ws.on('open', () => {
          console.log('WebSocket连接已建立');
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
              console.warn(`外部消息回调函数出错: ${e}`);
            }
          }
          this.processMessage(message);
        });

        this.ws.on('close', () => {
          console.log('WebSocket连接已关闭');
          this.connected = false;
          this.stopHeartbeat = true;
          if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
          }
        });

        this.ws.on('error', (error: Error) => {
          console.error(`WebSocket错误: ${error.message}`);
          this.connected = false;
          clearTimeout(timeoutTimer);
          if (this.connectReject) {
            this.connectReject(error);
          }
        });
      } catch (e) {
        console.error(`连接失败: ${e}`);
        this.connected = false;
        if (this.connectReject) {
          this.connectReject(e);
        }
      }
    });
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
        console.log(`已获取RSA公钥`);
        console.log(`会话ID: ${data.si}`);
        // 设置连接状态为已连接
        this.connected = true;
        console.log('WebSocket连接已建立');
        // 发送第二个请求（等待第二个请求响应后再完成Promise）
        this.sendSecondRequest();
      } else if ('data' in data && 'hostName' in data.data) {
        // 这是第二个请求的响应（获取主机名）
        this.hostName = data.data.hostName;
        this.trimVersion = data.data.trimVersion;
        console.log(`主机名: ${this.hostName}`);
        console.log(`Trim版本: ${this.trimVersion}`);
        // 启动心跳机制
        this.startHeartbeat();
        // 设置连接future完成（在心跳启动后）
        if (this.connectResolve) {
          this.connectResolve(true);
          this.connectResolve = null;
        }
      } else if ('res' in data && data.res === 'pong') {
        // 这是心跳响应
        console.log('收到心跳响应: pong');
      } else if ('longToken' in data && 'result' in data && data.result === 'succ') {
        // 这是账号密码登录响应
        this.loginResponse = data;
        // 解密secret字段并保存
        if ('secret' in data && data.secret) {
          this.decryptedSecret = this.decryptLoginSecret(data.secret);
          this.token = data.token;
          this.longToken = data.longToken;
          console.log(`服务器返回的secret: ${this.decryptedSecret?.substring(0, 20)}...`);
        }
        if (this.loginResolve) {
          this.loginResolve(this.loginResponse!);
          this.loginResolve = null;
        }
        console.log('登录成功');
      } else if ('result' in data && data.result === 'fail' && this.loginReqid && 'reqid' in data && data.reqid === this.loginReqid) {
        // 登录失败
        this.loginResponse = data;
        if (this.loginReject) {
          this.loginReject(new Error(data.msg || data.errmsg || '未知错误'));
          this.loginReject = null;
        }
        console.error(`登录失败: ${data.msg || data.errmsg || '未知错误'}`);
      } else {
        // 检查消息中是否包含reqid，这可能是待处理请求的响应
        if ('reqid' in data) {
          const reqid = data.reqid as string;
          const pending = this.pendingRequests.get(reqid);
          if (pending) {
            this.pendingRequests.delete(reqid);
            pending.future.resolve(data);
            console.log(`收到待处理请求的响应: ${reqid}`);
          } else {
            console.warn(`收到未知请求ID的响应: ${reqid}`);
          }
        } else {
          console.warn(`收到未知消息: ${message}`);
        }
      }
    } catch (e) {
      // 如果不是JSON格式，检查是否有待处理的请求在等待这个响应
      for (const [reqId, reqData] of this.pendingRequests.entries()) {
        reqData.future.resolve(message);
        this.pendingRequests.delete(reqId);
        break;
      }
      console.error(`无法解析消息: ${message}`);
    }
  }

  /**
   * 发送消息到服务器
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageJson = JSON.stringify(message);
      console.log(`Sending message: ${messageJson}`);
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
    this.heartbeatTimer = setInterval(() => {
      if (!this.stopHeartbeat && this.connected) {
        const message = {
          req: 'ping',
        };
        this.sendMessage(message);
        console.log('已发送心跳请求');
      }
    }, 30000); // 每30秒发送一次
  }

  /**
   * 用户登录方法
   */
  login(username: string, password: string, timeout: number = 10000): Promise<LoginResponse> {
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

      // 加密登录数据
      const encryptedData = this.encryptLoginData(username, password);
      console.log('Sending login request');

      // 发送登录请求并等待响应
      this.loginResolve = resolve;
      this.loginReject = reject;
      this.sendMessage(encryptedData);

      // 设置超时
      const timeoutTimer = setTimeout(() => {
        this.loginReqid = null;
        if (this.loginReject) {
          this.loginReject(new Error('登录超时'));
          this.loginReject = null;
        }
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
      console.log('使用 long_token 登录');
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
    console.log(`Sending msg: ${e}`);
    const izResult = this.iz(e);
    console.log(`Calculated iz-result: ${izResult}`);
    const requestData = izResult + e;
    console.log(`Sending msg to channel: ${requestData}`);

    // 发送数据
    if (this.ws) {
      this.ws.send(requestData);
      console.log(`已发送请求: ${requestData}`);
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
      this.pendingRequests.set(reqid, {
        future: future,
        req: req,
        payload: payload,
      });

      // 构造请求数据
      const payloadData = { ...payload };
      payloadData.req = req;
      payloadData.reqid = reqid;

      // JSON序列化之后访问request()方法完成发送
      const jsonData = JSON.stringify(payloadData);
      this.request(jsonData).catch((e) => {
        this.pendingRequests.delete(reqid);
        reject(e);
      });

      // 设置超时
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(reqid);
        reject(new Error(`请求 ${req} 超时`));
      }, timeout);
    });
  }

  /**
   * 重连方法
   */
  async reconnect(connectTimeout: number = 3000, loginTimeout: number = 10000): Promise<boolean> {
    if (this.connected) {
      console.log('已经连接，无需重连');
      return true;
    }

    if (!this.endpoint) {
      throw new Error('没有保存的endpoint用于重连');
    }

    if (!this.username || !this.password) {
      throw new Error('没有保存的用户名和密码用于重连');
    }

    console.log('开始重连...');

    // 先连接
    await this.connect(this.endpoint, connectTimeout);

    // 再登录
    const loginResult = await this.login(this.username, this.password, loginTimeout);

    if (loginResult?.result === 'succ') {
      console.log('重连成功');
      return true;
    } else {
      throw new Error('重连失败：登录失败');
    }
  }

  /**
   * 关闭WebSocket连接
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.stopHeartbeat = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }
}