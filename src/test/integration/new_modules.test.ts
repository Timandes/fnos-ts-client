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
import { FnosClient, SAC, DockerManager, EventLogger, Share, Notify, IscsiManager } from '../../index.js';
import { cleanupClient } from './helpers.js';

describe('SAC Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should get UPS status', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const sac = new SAC(client);
    const result = await sac.upsStatus();

    assert.strictEqual(result.result, 'succ');
  });
});

describe('DockerManager Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should list compose projects', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const docker = new DockerManager(client);
    const result = await docker.listComposes();

    assert.strictEqual(result.result, 'succ');
  });

  it('should list containers', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const docker = new DockerManager(client);
    const result = await docker.listContainers();

    assert.strictEqual(result.result, 'succ');
  });

  it('should get container stats', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const docker = new DockerManager(client);
    const result = await docker.stats();

    assert.strictEqual(result.result, 'succ');
  });

  it('should get system settings', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const docker = new DockerManager(client);
    const result = await docker.getSystemSettings();

    assert.strictEqual(result.result, 'succ');
  });
});

describe('EventLogger Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should list event logs', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const logger = new EventLogger(client);
    const result = await logger.commonList();

    assert.strictEqual(result.result, 'succ');
  });
});

describe('Share Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should get SMB options', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const share = new Share(client);
    const result = await share.smbOpt();

    assert.strictEqual(result.result, 'succ');
  });
});

describe('Notify Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should get unread total', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const notify = new Notify(client);
    const result = await notify.unreadTotal();

    assert.strictEqual(result.result, 'succ');
  });
});

describe('IscsiManager Integration Tests', () => {
  let client: FnosClient;

  afterEach(async () => {
    if (client) {
      await cleanupClient(client);
    }
  });

  it('should get iSCSI config', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const iscsi = new IscsiManager(client);
    const result = await iscsi.getConfig();

    assert.strictEqual(result.result, 'succ');
  });

  it('should list iSCSI initiators', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const iscsi = new IscsiManager(client);
    const result = await iscsi.listInitiators();

    assert.strictEqual(result.result, 'succ');
  });

  it('should list iSCSI LUNs', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const iscsi = new IscsiManager(client);
    const result = await iscsi.listLuns();

    assert.strictEqual(result.result, 'succ');
  });

  it('should list iSCSI LUN usergroups', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const iscsi = new IscsiManager(client);
    const result = await iscsi.listLunUsergroups();

    assert.strictEqual(result.result, 'succ');
  });

  it('should list iSCSI targets', async () => {
    client = new FnosClient();
    await client.connect('127.0.0.1:5666', 3000);
    assert.ok(client.isConnected(), '连接失败');

    const loginResult = await client.login('admin', 'admin', 10000);
    assert.strictEqual(loginResult.result, 'succ', `登录失败: ${JSON.stringify(loginResult)}`);

    const iscsi = new IscsiManager(client);
    const result = await iscsi.listTargets();

    assert.strictEqual(result.result, 'succ');
  });
});
