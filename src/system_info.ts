// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { FnosClient } from './client.js';

/**
 * 系统信息类
 */
export class SystemInfo {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 请求主机名信息
   */
  async getHostName(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.sysinfo.getHostName', {}, timeout);
    return response;
  }

  /**
   * 请求Trim版本信息
   */
  async getTrimVersion(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.sysinfo.getTrimVersion', {}, timeout);
    return response;
  }

  /**
   * 请求机器ID信息
   */
  async getMachineId(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.sysinfo.getMachineId', {}, timeout);
    return response;
  }

  /**
   * 请求硬件信息
   */
  async getHardwareInfo(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.sysinfo.getHardwareInfo', {}, timeout);
    return response;
  }

  /**
   * 请求系统运行时间信息
   */
  async getUptime(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.sysinfo.getUptime', {}, timeout);
    return response;
  }

  async getReservedPartition(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.sysinfo.getReservedPartition',
      {},
      timeout,
    );
  }
}
