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

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FnosClient } from '../../client.js';
import { ALL_QUERY_CASES } from '../unit/query_cases.js';

describe('extended query integration', () => {
  const client = new FnosClient();

  before(async () => {
    await client.connect('127.0.0.1:5666', 20000);
    const login = await client.login('admin', 'admin', 20000);
    assert.equal(login.result, 'succ');
  });

  after(() => client.close());

  it('routes all 71 unique endpoints', async () => {
    const unique = new Map(
      ALL_QUERY_CASES.map((query) => [query.endpoint, query]),
    );
    assert.equal(ALL_QUERY_CASES.length, 82);
    assert.equal(unique.size, 71);
    for (const [endpoint, query] of unique) {
      const result = await query.invoke(client, 20000) as Record<string, unknown>;
      assert.equal(typeof result, 'object', endpoint);
      assert.doesNotMatch(
        String(result.errmsg ?? ''),
        /Unknown request type/,
        endpoint,
      );
    }
  });
});
