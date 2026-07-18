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
import { requirePositiveInteger } from './validation.js';

export class NetworkServer {
  constructor(private readonly client: FnosClient) {}

  async listCertificates(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.netsvr.cert.list',
      {},
      timeout,
    );
  }

  async getConnectionConfig(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.netsvr.conn.getconfig',
      {},
      timeout,
    );
  }

  async getConnectionStatus(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.netsvr.conn.status',
      {},
      timeout,
    );
  }

  async listDdnsProviders(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.netsvr.ddns.provider.list',
      {},
      timeout,
    );
  }

  async listDdnsRecords(
    page: number = 1,
    pageSize: number = 200,
    timeout: number = 10000,
  ): Promise<any> {
    requirePositiveInteger('page', page);
    requirePositiveInteger('pageSize', pageSize);
    return this.client.requestPayloadWithResponse(
      'appcgi.netsvr.ddns.record.list',
      { data: { page, pageSize } },
      timeout,
    );
  }
}
