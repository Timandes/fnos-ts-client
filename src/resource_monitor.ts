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

import { FnosClient } from './client.js';

/**
 * 资源监控类
 */
export class ResourceMonitor {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 请求CPU资源监控信息
   */
  async cpu(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.resmon.cpu', {}, timeout);
    return response;
  }

  /**
   * 请求GPU资源监控信息
   */
  async gpu(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.resmon.gpu', {}, timeout);
    return response;
  }

  /**
   * 请求内存资源监控信息
   */
  async memory(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.resmon.mem', {}, timeout);
    return response;
  }

  /**
   * 请求磁盘资源监控信息
   */
  async disk(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.resmon.disk', {}, timeout);
    return response;
  }

  /**
   * 请求网络资源监控信息
   */
  async net(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.resmon.net', {}, timeout);
    return response;
  }

  /**
   * 请求通用资源监控信息
   */
  async general(timeout: number = 10000, items: string[] | null = null): Promise<any> {
    const defaultItems = ['storeSpeed', 'netSpeed', 'cpuBusy', 'memPercent'];
    const payload = { item: items || defaultItems };
    const response = await this.client.requestPayloadWithResponse('appcgi.resmon.gen', payload, timeout);
    return response;
  }
}