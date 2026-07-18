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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FnosClient } from '../../client.js';

type TestClient = Record<string, any>;

describe('FnosClient two-factor authentication', () => {
  it('accepts final success without longToken', () => {
    const client = new FnosClient() as unknown as TestClient;
    assert.equal(client.isFinalLoginSuccess({ result: 'succ', token: 't', secret: 's' }), true);
  });

  it('classifies bound and setup challenges', () => {
    const client = new FnosClient() as unknown as TestClient;
    const bound = {
      result: 'succ',
      isBindTwofaSecret: true,
      isTrustedDevice: false,
      accessToken: 'access',
      secureEmail: 'ti***@example.com',
    };
    const setup = {
      result: 'succ',
      isTwofaEnforced: true,
      isBindTwofaSecret: false,
      accessToken: 'setup-access',
    };
    assert.equal(client.isTwofaChallenge(bound), true);
    assert.equal(client.isTwofaSetupChallenge(bound), false);
    assert.equal(client.isTwofaChallenge(setup), false);
    assert.equal(client.isTwofaSetupChallenge(setup), true);
  });

  it('builds a configurable login payload through common encryption', () => {
    const client = new FnosClient() as unknown as TestClient;
    client.publicKey = 'public-key';
    client.sessionId = 'session';
    client.generateReqid = () => 'login-reqid';
    client.generateDid = () => 'device-id';
    let payload: Record<string, unknown> | undefined;
    client.encryptAuthData = (value: Record<string, unknown>) => {
      payload = value;
      return { req: 'encrypted' };
    };
    client.encryptLoginData('alice', 'password', false, 'CLI', 'test-device');
    assert.deepEqual(payload, {
      reqid: 'login-reqid',
      user: 'alice',
      password: 'password',
      stay: false,
      deviceType: 'CLI',
      deviceName: 'test-device',
      did: 'device-id',
      req: 'user.login',
      si: 'session',
    });
  });

  it('rejects an invalid code and a missing challenge', async () => {
    const client = new FnosClient() as unknown as TestClient;
    client.connected = true;
    client.publicKey = 'public-key';
    client.sessionId = 'session';
    client.twofaPending = {
      accessToken: 'access',
      username: 'alice',
      stay: true,
      deviceType: 'Browser',
      deviceName: 'Mac OS-Safari',
    };
    await assert.rejects(client.submitTwofaCode('12ab56'), /6位数字/);
    client.twofaPending = null;
    await assert.rejects(client.submitTwofaCode('583213'), /没有待完成/);
  });

  it('routes a bound challenge to the login resolver', () => {
    const client = new FnosClient() as unknown as TestClient;
    client.loginContext = {
      username: 'alice',
      stay: true,
      deviceType: 'Browser',
      deviceName: 'Mac OS-Safari',
    };
    let resolved: Record<string, unknown> | undefined;
    client.loginResolve = (value: Record<string, unknown>) => {
      resolved = value;
    };
    client.processMessage(JSON.stringify({
      result: 'succ',
      isBindTwofaSecret: true,
      isTrustedDevice: false,
      accessToken: 'access',
      reqid: 'login-reqid',
    }));
    assert.equal(resolved?.twofaRequired, true);
    assert.equal(resolved?.twofaSetupRequired, false);
    assert.equal(client.twofaPending.accessToken, 'access');
  });

  it('builds and routes a 2FA verification attempt', async () => {
    const client = new FnosClient() as unknown as TestClient;
    client.connected = true;
    client.publicKey = 'public-key';
    client.sessionId = 'session';
    client.twofaPending = {
      accessToken: 'access',
      username: 'alice',
      stay: true,
      deviceType: 'Browser',
      deviceName: 'Mac OS-Safari',
    };
    client.generateReqid = () => 'twofa-reqid';
    client.generateDid = () => 'device-id';
    let payload: Record<string, unknown> | undefined;
    client.encryptAuthData = (value: Record<string, unknown>) => {
      payload = value;
      return { req: 'encrypted' };
    };
    client.sendMessage = () => undefined;
    const pending = client.submitTwofaCode('583213', true, 1000);
    client.processMessage(JSON.stringify({
      result: 'fail',
      reqid: 'twofa-reqid',
      errno: 135168,
    }));
    assert.equal((await pending).result, 'fail');
    assert.deepEqual(payload, {
      reqid: 'twofa-reqid',
      code: '583213',
      isTrustedDevice: true,
      accessToken: 'access',
      stay: 1,
      deviceName: 'Mac OS-Safari',
      deviceType: 'Browser',
      did: 'device-id',
      req: 'user.2fa.loginVerify',
      si: 'session',
    });
    assert.equal(client.twofaPending.accessToken, 'access');
  });

  it('stores final 2FA credentials and clears pending state', () => {
    const client = new FnosClient() as unknown as TestClient;
    client.twofaReqid = 'twofa-reqid';
    client.twofaPending = { accessToken: 'access' };
    client.decryptLoginSecret = () => 'decrypted-secret';
    let resolved: Record<string, unknown> | undefined;
    client.twofaResolve = (value: Record<string, unknown>) => {
      resolved = value;
    };
    client.processMessage(JSON.stringify({
      result: 'succ',
      reqid: 'twofa-reqid',
      token: 'short-token',
      secret: 'encrypted-secret',
    }));
    assert.equal(resolved?.token, 'short-token');
    assert.equal(client.longToken, null);
    assert.equal(client.decryptedSecret, 'decrypted-secret');
    assert.equal(client.twofaPending, null);
  });
});
