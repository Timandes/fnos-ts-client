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

export class DownloadCenter {
  constructor(private readonly client: FnosClient) {}

  async getDefaultSaveDirectory(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.downloadcenter.config.getDefaultSaveDir',
      {},
      timeout,
    );
  }

  async getStatistics(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.downloadcenter.stat.all',
      {},
      timeout,
    );
  }

  async queryTasks(
    stateFilter: number = 65535,
    initFlag: boolean = true,
    timeout: number = 10000,
  ): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.downloadcenter.task.query',
      { init_flag: initFlag, state_filter: stateFilter },
      timeout,
    );
  }
}
