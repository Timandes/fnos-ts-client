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

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FnosClient } from '../../client.js';

type TestClient = Record<string, any>;

describe('FnosClient - Timer Cleanup', () => {
  let client: FnosClient | undefined;

  afterEach(() => {
    client?.close();
  });

  function prepareLoginClient(): TestClient {
    const prepared = new FnosClient() as unknown as TestClient;
    prepared.connected = true;
    prepared.publicKey = 'public-key';
    prepared.sessionId = 'session-id';
    prepared.encryptLoginData = () => {
      prepared.loginReqid = 'login-reqid';
      return { req: 'encrypted' };
    };
    prepared.sendMessage = () => undefined;
    return prepared;
  }

  it('should clear login timeout timer when login succeeds', async () => {
    const prepared = prepareLoginClient();
    client = prepared as FnosClient;
    prepared.decryptLoginSecret = () => 'decrypted-secret';

    const loginPromise = client.login('testuser', 'testpass', 10000);
    prepared.processMessage(JSON.stringify({
      result: 'succ',
      token: 'test-token',
      longToken: 'test-long-token',
      secret: 'encrypted-secret',
      reqid: 'login-reqid',
    }));

    await loginPromise;
    assert.equal(prepared.loginTimeoutTimer, null);
  });

  it('should clear login timeout timer when login fails', async () => {
    const prepared = prepareLoginClient();
    client = prepared as FnosClient;

    const loginPromise = client.login('testuser', 'wrongpass', 10000);
    prepared.processMessage(JSON.stringify({
      result: 'fail',
      msg: 'Invalid credentials',
      reqid: 'login-reqid',
    }));

    await assert.rejects(loginPromise, /Invalid credentials/);
    assert.equal(prepared.loginTimeoutTimer, null);
  });

  it('should clear request timeout timer when response is received', async () => {
    const prepared = new FnosClient() as unknown as TestClient;
    client = prepared as FnosClient;
    prepared.connected = true;
    prepared.request = async () => undefined;

    const requestPromise = client.requestPayloadWithResponse('user.info', {}, 10000);
    const [reqid] = prepared.pendingRequests.keys();
    prepared.processMessage(JSON.stringify({
      result: 'succ',
      reqid,
      data: { test: 'data' },
    }));

    const response = await requestPromise;
    assert.deepEqual(response.data, { test: 'data' });
    assert.equal(prepared.pendingRequests.size, 0);
  });

  it('should clear all timers when close() is called', async () => {
    const prepared = new FnosClient() as unknown as TestClient;
    client = prepared as FnosClient;
    prepared.connected = true;
    prepared.request = async () => undefined;
    prepared.loginTimeoutTimer = setTimeout(() => undefined, 10000);

    const requestPromise = client.requestPayloadWithResponse('user.info', {}, 10000);
    const requestRejection = assert.rejects(requestPromise, /连接已关闭/);
    client.close();

    await requestRejection;
    assert.equal(prepared.loginTimeoutTimer, null);
    assert.equal(prepared.pendingRequests.size, 0);
  });
});
