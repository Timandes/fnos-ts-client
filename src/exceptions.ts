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

/**
 * 当 FnosClient 未连接到服务器时抛出的异常
 */
export class NotConnectedError extends Error {
  constructor(message: string = '未连接到服务器') {
    super(message);
    this.name = 'NotConnectedError';
  }
}

/**
 * fnOS 将不安全的 WebSocket 握手重定向到 HTTPS 时抛出的异常
 */
export class HTTPSRequiredError extends Error {
  constructor(
    public readonly requestedUri: string,
    public readonly redirectUri: string,
    public readonly statusCode: number,
  ) {
    super(
      'fnOS 服务端要求安全连接；当前 WS 连接被重定向到 HTTPS。' +
      '请使用 wss:// endpoint 或传入 useSsl=true。' +
      `重定向地址：${redirectUri}`,
    );
    this.name = 'HTTPSRequiredError';
  }
}
