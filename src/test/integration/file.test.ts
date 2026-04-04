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
import { FnosClient, File } from '../../index.js';
import { cleanupClient } from './helpers.js';

describe('File Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should list files (default path)', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const file = new File(client);
    const result = await file.list();

    assert.ok(result, '响应不应为空');
    assert.ok('files' in result || 'data' in result || 'result' in result, `响应应包含 files、data 或 result 字段，实际: ${JSON.stringify(result)}`);
  });

  it('should get file ACL', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const file = new File(client);
    const result = await file.getAcl(['vol2/@team/data']);

    assert.ok(result, '响应不应为空');
  });
});
