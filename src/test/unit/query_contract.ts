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

import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { FnosClient } from '../../client.js';

export interface QueryCase {
  name: string;
  endpoint: string;
  payload: Record<string, unknown>;
  invoke: (client: FnosClient, timeout: number) => Promise<unknown>;
}

export async function assertQueryCase(query: QueryCase): Promise<void> {
  const client = new FnosClient();
  const sentinel = { result: 'sentinel' };
  const request = mock.method(
    client,
    'requestPayloadWithResponse',
    async () => sentinel,
  );
  try {
    const result = await query.invoke(client, 2500);
    assert.equal(result, sentinel);
    assert.equal(request.mock.callCount(), 1);
    assert.deepEqual(
      request.mock.calls[0].arguments,
      [query.endpoint, query.payload, 2500],
    );
  } finally {
    request.mock.restore();
  }
}
