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
import { FnosClient, SystemInfo } from '../../index.js';
import { cleanupClient } from './helpers.js';

describe('SystemInfo Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should have host name after connect', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    // connect() 内部已发送 getHostName 请求并保存结果
    assert.ok((client as any).hostName, '连接后应保存主机名');
    assert.ok((client as any).trimVersion, '连接后应保存 trim 版本');
  });

  it('should get machine id', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const systemInfo = new SystemInfo(client);
    const result = await systemInfo.getMachineId();

    assert.strictEqual(result.result, 'succ');
  });

  it('should get trim version', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const systemInfo = new SystemInfo(client);
    const result = await systemInfo.getTrimVersion();

    assert.strictEqual(result.result, 'succ');
  });

  it('should get uptime', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const systemInfo = new SystemInfo(client);
    const result = await systemInfo.getUptime();

    assert.strictEqual(result.result, 'succ');
  });

  it('should get hardware info', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const systemInfo = new SystemInfo(client);
    const result = await systemInfo.getHardwareInfo();

    assert.strictEqual(result.result, 'succ');
  });
});
