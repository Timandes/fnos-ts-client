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

import type { FnosRequestClient } from './request_client.js';

/**
 * 通知类
 */
export class Notify {
  private client: FnosRequestClient;

  constructor(client: FnosRequestClient) {
    this.client = client;
  }

  /**
   * 获取未读通知总数
   */
  async unreadTotal(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('notify.unreadTotal', {}, timeout);
    return response;
  }
}
