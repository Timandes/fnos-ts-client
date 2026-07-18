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

export class BackupManager {
  constructor(private readonly client: FnosClient) {}

  async listTasks(direction: number, timeout: number = 10000): Promise<any> {
    if (direction !== 0 && direction !== 1) {
      throw new RangeError('direction参数必须为0或1');
    }
    return this.client.requestPayloadWithResponse(
      'appcgi.backup.task.list',
      { direction },
      timeout,
    );
  }
}
