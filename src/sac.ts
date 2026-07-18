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
 * SAC类
 */
export class SAC {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 请求UPS状态信息
   */
  async upsStatus(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.sac.ups.v1.status', {}, timeout);
    return response;
  }

  async getEmailConfig(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.sac.externalnotify.v1.email.getConfig',
      {},
      timeout,
    );
  }

  async listEmailProviders(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.sac.externalnotify.v1.email.getProviders',
      {},
      timeout,
    );
  }
}
