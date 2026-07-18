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

export class LicenseManager {
  constructor(private readonly client: FnosClient) {}

  async list(
    page: number = 1,
    pageSize: number = 200,
    timeout: number = 10000,
  ): Promise<any> {
    requirePositiveInteger('page', page);
    requirePositiveInteger('pageSize', pageSize);
    return this.client.requestPayloadWithResponse(
      'appcgi.license.soft.list',
      { data: { page, pageSize } },
      timeout,
    );
  }
}
