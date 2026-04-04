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

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { FnosClient, Network } from '../../index.js';
import { cleanupClient } from './helpers.js';

describe('Network Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should list network interfaces', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const network = new Network(client);
    const result = await network.list();

    assert.strictEqual(result.result, 'succ');
  });

  it('should detect network', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const network = new Network(client);
    const result = await network.detect('eth0');

    assert.strictEqual(result.result, 'succ');
  });
});
