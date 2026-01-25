// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the "License');
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
 * 存储类
 */
export class Store {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 请求存储通用信息
   */
  async general(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('stor.general', {}, timeout);
    return response;
  }

  /**
   * 计算存储空间信息
   */
  async calculateSpace(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('stor.calcSpace', {}, timeout);
    return response;
  }

  /**
   * 列出磁盘信息
   */
  async listDisks(noHotSpare: boolean = true, timeout: number = 10000): Promise<any> {
    const payload = { noHotSpare: noHotSpare };
    const response = await this.client.requestPayloadWithResponse('stor.listDisk', payload, timeout);
    return response;
  }

  /**
   * 获取磁盘SMART信息
   */
  async getDiskSmart(disk: string, timeout: number = 10000): Promise<any> {
    const payload = { disk: disk };
    const response = await this.client.requestPayloadWithResponse('stor.diskSmart', payload, timeout);
    return response;
  }

  /**
   * 获取存储状态信息
   */
  async getState(name: string[], uuid: string[], timeout: number = 10000): Promise<any> {
    const payload = { name: name, uuid: uuid };
    const response = await this.client.requestPayloadWithResponse('stor.state', payload, timeout);
    return response;
  }
}