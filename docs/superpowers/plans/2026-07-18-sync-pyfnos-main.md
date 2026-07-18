# Sync pyfnos Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 pyfnos `main@11d5b9e` 中可移植的 2FA、HTTPS 异常、71 个只读查询端点、示例和磁盘温度诊断能力同步到 TypeScript SDK。

**Architecture:** 保持 `FnosClient` 作为连接和认证边界，领域类只校验参数并构造精确 payload。离线数据驱动契约测试覆盖 82 种请求组合，固定版本的 fnos-mock-server 只承担端到端路由验证；示例和工具通过独立 CLI 边界复用 SDK，不向生产包增加依赖。

**Tech Stack:** TypeScript 5.7、Node.js 20/22、`ws` 8、`node:test`、`tsx`、fnos-mock-server `d9592a05a8e07082b954921acfae3a9a915f3c01`

## Global Constraints

- 上游来源固定为 pyfnos `11d5b9e`，实现期间不追随更新提交。
- 公共 TypeScript API 使用 camelCase，现有调用必须保持兼容。
- 只同步 71 个具有配套请求 fixture 的只读端点，不实现规格列出的 7 个延后端点。
- 服务端响应原样返回；领域类不缓存、不重试、不重塑响应。
- 检测强制 HTTPS 后不自动切换 WSS，也不自动重试。
- 不增加生产依赖，不修改 npm 版本 `0.3.0`，Changelog 写入 `Unreleased`。
- 每个行为变更必须先看到对应测试以预期原因失败，再写生产实现。
- 所有提交使用英文 Angular/Conventional Commits，禁止 `Co-Authored-By`。

---

## File Structure

### Core

- `src/client.ts`：2FA 状态机、通用认证加密、HTTP 握手错误路由。
- `src/exceptions.ts`：`NotConnectedError` 与 `HTTPSRequiredError`。
- `src/validation.ts`：领域查询参数的私有校验辅助函数。
- `src/index.ts`：公共导出，不修改版本常量。

### Query domains

- Modify: `src/docker_manager.ts`, `src/network.ts`, `src/resource_monitor.ts`, `src/file.ts`, `src/store.ts`, `src/user.ts`, `src/share.ts`, `src/sac.ts`, `src/system_info.ts`。
- Create: `src/backup_manager.ts`, `src/download_center.ts`, `src/ip_blocker.ts`, `src/license_manager.ts`, `src/live_update.ts`, `src/mount_manager.ts`, `src/network_server.ts`, `src/security.ts`, `src/system_restore.ts`。

### Tests

- `src/test/unit/twofa.test.ts`：认证状态机和 2FA payload。
- `src/test/unit/https_required.test.ts`：真实本地 HTTP 3xx 握手测试。
- `src/test/unit/validation.test.ts`：所有校验边界。
- `src/test/unit/query_contract.ts`：契约测试公共结构。
- `src/test/unit/query_cases.ts`：82 种请求组合的单一事实源。
- `src/test/unit/query_contract.test.ts`：离线精确 endpoint/payload 测试。
- `src/test/integration/twofa.test.ts`：mock-server 两步验证流程。
- `src/test/integration/extended_queries.test.ts`：71 个唯一端点路由验证。

### Examples and tools

- `examples/common.ts`：示例共用连接、SSL 和 2FA 认证编排。
- `examples/twofa_login.ts`, `examples/https_required_error.ts`：认证与连接诊断示例。
- 9 个新增领域示例和 9 个现有示例扩展。
- `tools/common.ts`, `tools/list_disk_temperatures.ts`：工具认证与磁盘温度诊断。
- `tools/test/common.test.ts`, `tools/test/list_disk_temperatures.test.ts`：通过 `tsx --test` 运行的工具测试。

---

### Task 1: Two-factor authentication state machine

**Files:**

- Modify: `src/client.ts:37-75,108-150,291-360,457-495,709-746`
- Create: `src/test/unit/twofa.test.ts`

**Interfaces:**

- Consumes: 现有 `Crypto`、`FnosClient.sendMessage()`、WebSocket 消息路由。
- Produces: 扩展后的 `LoginResponse`、兼容旧签名的 `login()`、新增 `submitTwofaCode()`。

- [ ] **Step 1: Write failing classification and payload tests**

Create `src/test/unit/twofa.test.ts` with focused tests that invoke private helpers through a narrow test cast:

```ts
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
      result: 'succ', isBindTwofaSecret: true, isTrustedDevice: false,
      accessToken: 'access', secureEmail: 'ti***@example.com',
    };
    const setup = {
      result: 'succ', isTwofaEnforced: true, isBindTwofaSecret: false,
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
      reqid: 'login-reqid', user: 'alice', password: 'password', stay: false,
      deviceType: 'CLI', deviceName: 'test-device', did: 'device-id',
      req: 'user.login', si: 'session',
    });
  });

  it('rejects an invalid code and a missing challenge', async () => {
    const client = new FnosClient() as unknown as TestClient;
    client.connected = true;
    client.publicKey = 'public-key';
    client.sessionId = 'session';
    client.twofaPending = {
      accessToken: 'access', username: 'alice', stay: true,
      deviceType: 'Browser', deviceName: 'Mac OS-Safari',
    };
    await assert.rejects(client.submitTwofaCode('12ab56'), /6位数字/);
    client.twofaPending = null;
    await assert.rejects(client.submitTwofaCode('583213'), /没有待完成/);
  });

  it('routes a bound challenge to the login resolver', () => {
    const client = new FnosClient() as unknown as TestClient;
    client.loginContext = {
      username: 'alice', stay: true,
      deviceType: 'Browser', deviceName: 'Mac OS-Safari',
    };
    let resolved: Record<string, unknown> | undefined;
    client.loginResolve = (value: Record<string, unknown>) => { resolved = value; };
    client.processMessage(JSON.stringify({
      result: 'succ', isBindTwofaSecret: true, isTrustedDevice: false,
      accessToken: 'access', reqid: 'login-reqid',
    }));
    assert.equal(resolved?.twofaRequired, true);
    assert.equal(client.twofaPending.accessToken, 'access');
  });

  it('builds and routes a 2FA verification attempt', async () => {
    const client = new FnosClient() as unknown as TestClient;
    client.connected = true;
    client.publicKey = 'public-key';
    client.sessionId = 'session';
    client.twofaPending = {
      accessToken: 'access', username: 'alice', stay: true,
      deviceType: 'Browser', deviceName: 'Mac OS-Safari',
    };
    client.generateReqid = () => 'twofa-reqid';
    client.generateDid = () => 'device-id';
    let payload: Record<string, unknown> | undefined;
    client.encryptAuthData = (value: Record<string, unknown>) => {
      payload = value; return { req: 'encrypted' };
    };
    client.sendMessage = () => undefined;
    const pending = client.submitTwofaCode('583213', true, 1000);
    client.processMessage(JSON.stringify({ result: 'fail', reqid: 'twofa-reqid', errno: 135168 }));
    assert.equal((await pending).result, 'fail');
    assert.deepEqual(payload, {
      reqid: 'twofa-reqid', code: '583213', isTrustedDevice: true,
      accessToken: 'access', stay: 1, deviceName: 'Mac OS-Safari',
      deviceType: 'Browser', did: 'device-id', req: 'user.2fa.loginVerify',
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
    client.twofaResolve = (value: Record<string, unknown>) => { resolved = value; };
    client.processMessage(JSON.stringify({
      result: 'succ', reqid: 'twofa-reqid', token: 'short-token', secret: 'encrypted-secret',
    }));
    assert.equal(resolved?.token, 'short-token');
    assert.equal(client.longToken, null);
    assert.equal(client.decryptedSecret, 'decrypted-secret');
    assert.equal(client.twofaPending, null);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run build
```

Expected: TypeScript fails because `isFinalLoginSuccess`, `isTwofaChallenge`,
`isTwofaSetupChallenge`, `encryptAuthData`, and `submitTwofaCode` do not exist.

- [ ] **Step 3: Add 2FA types, state, and common encryption**

Extend `LoginResponse` and add the private state exactly as follows:

```ts
export interface LoginResponse {
  result: 'succ' | 'fail';
  token?: string;
  longToken?: string;
  secret?: string;
  msg?: string;
  errmsg?: string;
  reqid?: string;
  accessToken?: string;
  secureEmail?: string;
  isTwofaEnforced?: boolean;
  isBindTwofaSecret?: boolean;
  isTrustedDevice?: boolean;
  twofaRequired?: boolean;
  twofaSetupRequired?: boolean;
  [key: string]: unknown;
}

interface TwofaPending {
  accessToken: string;
  username: string;
  stay: boolean;
  deviceType: string;
  deviceName: string;
}

private twofaPending: TwofaPending | null = null;
private twofaReqid: string | null = null;
private twofaResolve: ((value: LoginResponse) => void) | null = null;
private twofaReject: ((reason?: unknown) => void) | null = null;
private twofaTimeoutTimer: NodeJS.Timeout | null = null;
private loginContext: Omit<TwofaPending, 'accessToken'> | null = null;
```

Replace the current encryption body with a reusable helper and a payload builder:

```ts
private encryptAuthData(payload: Record<string, unknown>): Record<string, string> {
  if (!this.publicKey || !this.sessionId) {
    throw new Error('未获取到公钥或会话ID');
  }
  this.aesKey = Crypto.randomBytes(32);
  const rsa = Crypto.rsaEncrypt(this.aesKey, this.publicKey);
  this.iv = Crypto.randomBytes(16);
  const aes = Crypto.aesEncryptWithPadding(
    JSON.stringify(payload), this.aesKey, this.iv,
  );
  return {
    req: 'encrypted',
    iv: Crypto.base64Encode(this.iv),
    rsa,
    aes: Crypto.base64Encode(aes),
  };
}

private encryptLoginData(
  username: string,
  password: string,
  stay = true,
  deviceType = 'Browser',
  deviceName = 'Mac OS-Safari',
): Record<string, string> {
  const reqid = this.generateReqid();
  this.loginReqid = reqid;
  return this.encryptAuthData({
    reqid, user: username, password, stay, deviceType, deviceName,
    did: this.generateDid(), req: 'user.login', si: this.sessionId,
  });
}
```

- [ ] **Step 4: Add challenge helpers and response routing**

Add these focused helpers to `FnosClient`:

```ts
private isFinalLoginSuccess(data: LoginResponse): boolean {
  return data.result === 'succ' && typeof data.token === 'string' &&
    typeof data.secret === 'string';
}

private isTwofaChallenge(data: LoginResponse): boolean {
  return data.result === 'succ' && data.isBindTwofaSecret === true &&
    data.isTrustedDevice === false && typeof data.accessToken === 'string' &&
    !data.token && !data.secret;
}

private isTwofaSetupChallenge(data: LoginResponse): boolean {
  return data.result === 'succ' && data.isTwofaEnforced === true &&
    data.isBindTwofaSecret === false && typeof data.accessToken === 'string' &&
    !data.token && !data.secret;
}

private clearTwofaAttempt(): void {
  if (this.twofaTimeoutTimer) clearTimeout(this.twofaTimeoutTimer);
  this.twofaTimeoutTimer = null;
  this.twofaReqid = null;
  this.twofaResolve = null;
  this.twofaReject = null;
}

private clearTwofaState(): void {
  this.clearTwofaAttempt();
  this.twofaPending = null;
}

private handleFinalLoginSuccess(data: LoginResponse): void {
  this.loginResponse = data;
  this.decryptedSecret = this.decryptLoginSecret(data.secret!);
  this.token = data.token ?? null;
  this.longToken = data.longToken ?? null;
}
```

In `processMessage()`, route in this order after pong handling: final success,
bound challenge, setup challenge, matching 2FA failure, matching login failure,
then ordinary pending requests. Use these exact state transitions:

```ts
// Final success
const resolveTwofa = data.reqid === this.twofaReqid ? this.twofaResolve : null;
this.handleFinalLoginSuccess(data);
if (this.loginTimeoutTimer) clearTimeout(this.loginTimeoutTimer);
this.loginTimeoutTimer = null;
this.clearTwofaState();
if (resolveTwofa) resolveTwofa(data);
else if (this.loginResolve) this.loginResolve(data);
this.loginResolve = null;
this.loginReject = null;

// Matching 2FA failure: keep twofaPending so the caller may retry.
const resolveFailure = this.twofaResolve;
this.clearTwofaAttempt();
resolveFailure?.(data);
```

Each challenge branch clears `loginTimeoutTimer`, resolves `loginResolve`, and
then nulls `loginResolve`/`loginReject`. Challenge branches populate:

```ts
this.twofaPending = {
  accessToken: data.accessToken!,
  username: this.loginContext!.username,
  stay: this.loginContext!.stay,
  deviceType: this.loginContext!.deviceType,
  deviceName: this.loginContext!.deviceName,
};
this.loginResponse = {
  ...data,
  twofaRequired: this.isTwofaChallenge(data),
  twofaSetupRequired: this.isTwofaSetupChallenge(data),
};
```

- [ ] **Step 5: Implement compatible login and `submitTwofaCode()`**

Use this public signature and store the same context passed into encryption:

```ts
login(
  username: string,
  password: string,
  timeout = 10000,
  stay = true,
  deviceType = 'Browser',
  deviceName = 'Mac OS-Safari',
): Promise<LoginResponse>
```

Add the new public method:

```ts
submitTwofaCode(code: string, trustDevice = false, timeout = 10000): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    if (!this.connected) return reject(new NotConnectedError('未连接到服务器'));
    if (!this.publicKey || !this.sessionId) return reject(new Error('未获取到公钥或会话ID'));
    if (!this.twofaPending) return reject(new Error('没有待完成的两步验证登录'));
    if (!/^\d{6}$/.test(code)) return reject(new RangeError('两步验证码必须是6位数字'));

    const reqid = this.generateReqid();
    this.twofaReqid = reqid;
    this.twofaResolve = resolve;
    this.twofaReject = reject;
    const pending = this.twofaPending;
    const encrypted = this.encryptAuthData({
      reqid,
      code,
      isTrustedDevice: trustDevice,
      accessToken: pending.accessToken,
      stay: pending.stay ? 1 : 0,
      deviceName: pending.deviceName,
      deviceType: pending.deviceType,
      did: this.generateDid(),
      req: 'user.2fa.loginVerify',
      si: this.sessionId,
    });
    this.sendMessage(encrypted);
    this.twofaTimeoutTimer = setTimeout(() => {
      const timeoutReject = this.twofaReject;
      this.clearTwofaAttempt();
      timeoutReject?.(new Error('两步验证超时'));
    }, timeout);
  });
}
```

Update `close()` to save `twofaReject`, call `clearTwofaState()`, and reject an
outstanding 2FA promise with `连接已关闭`.

- [ ] **Step 6: Verify all routing assertions are GREEN**

The Step 1 routing tests must now satisfy these assertions:

```ts
assert.equal(challenge.twofaRequired, true);
assert.equal(challenge.twofaSetupRequired, false);
assert.equal((client as TestClient).twofaPending.accessToken, 'access');
assert.equal(final.token, 'short-token');
assert.equal((client as TestClient).longToken, null);
assert.equal((client as TestClient).twofaPending, null);
```

Run:

```bash
npm run build && node --test dist/test/unit/twofa.test.js
```

Expected: all 2FA tests pass with no leaked timers or warning output.

- [ ] **Step 7: Commit the 2FA behavior**

```bash
git add src/client.ts src/test/unit/twofa.test.ts
git commit -m "feat: add two-factor login support"
```

---

### Task 2: HTTPS-required connection error

**Files:**

- Modify: `src/exceptions.ts:15-24`
- Modify: `src/client.ts:15-19,194-286`
- Modify: `src/index.ts:18-35`
- Create: `src/test/unit/https_required.test.ts`

**Interfaces:**

- Consumes: `ws` `unexpected-response` event and Node `IncomingMessage`.
- Produces: public `HTTPSRequiredError` with `requestedUri`, `redirectUri`, and `statusCode`.

- [ ] **Step 1: Write a real local redirect test**

```ts
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FnosClient } from '../../client.js';
import { HTTPSRequiredError } from '../../exceptions.js';

describe('HTTPSRequiredError', () => {
  it('converts one WS to HTTPS redirect without retrying', async () => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests += 1;
      res.writeHead(302, { Location: 'https://nas.example.com:5667/websocket?type=main' });
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const client = new FnosClient();
    try {
      await assert.rejects(
        client.connect(`127.0.0.1:${port}`),
        (error: unknown) => {
          assert.ok(error instanceof HTTPSRequiredError);
          assert.equal(error.statusCode, 302);
          assert.equal(error.redirectUri, 'https://nas.example.com:5667/websocket?type=main');
          assert.match(error.requestedUri, /^ws:\/\/127\.0\.0\.1:/);
          return true;
        },
      );
      assert.equal(requests, 1);
    } finally {
      client.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  for (const testCase of [
    { name: 'ordinary HTTP error', status: 401, location: undefined },
    { name: 'redirect without Location', status: 302, location: undefined },
    { name: 'redirect to HTTP', status: 302, location: 'http://nas.example.com/' },
  ]) {
    it(`does not misclassify ${testCase.name}`, async () => {
      const server = createServer((_req, res) => {
        const headers = testCase.location ? { Location: testCase.location } : {};
        res.writeHead(testCase.status, headers);
        res.end();
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as AddressInfo).port;
      const client = new FnosClient();
      try {
        await assert.rejects(
          client.connect(`127.0.0.1:${port}`),
          (error: unknown) => error instanceof Error && !(error instanceof HTTPSRequiredError),
        );
      } finally {
        client.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  }

  it('never converts an already secure WSS attempt', () => {
    const client = new FnosClient() as unknown as Record<string, any>;
    const response = {
      statusCode: 302,
      headers: { location: 'https://nas.example.com/websocket?type=main' },
    };
    assert.equal(client.httpsRequiredError('wss://nas.example.com/websocket?type=main', true, response), null);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `npm run build`.

Expected: compile failure because `HTTPSRequiredError` is not exported.

- [ ] **Step 3: Implement the structured exception**

Add to `src/exceptions.ts`:

```ts
export class HTTPSRequiredError extends Error {
  constructor(
    public readonly requestedUri: string,
    public readonly redirectUri: string,
    public readonly statusCode: number,
  ) {
    super(
      'fnOS 服务端要求安全连接；当前 WS 连接被重定向到 HTTPS。' +
      '请使用 wss:// endpoint 或传入 useSsl=true。' +
      `重定向地址：${redirectUri}`,
    );
    this.name = 'HTTPSRequiredError';
  }
}
```

Export it from `src/index.ts` beside `NotConnectedError`.

- [ ] **Step 4: Convert only matching handshake responses**

Import `IncomingMessage` and the SDK exception, then add a helper:

```ts
import type { IncomingMessage } from 'node:http';
import { HTTPSRequiredError, NotConnectedError } from './exceptions.js';
```

```ts
private httpsRequiredError(
  requestedUri: string,
  actualUseSsl: boolean,
  response: IncomingMessage,
): HTTPSRequiredError | null {
  const statusCode = response.statusCode;
  const location = response.headers.location;
  if (actualUseSsl || !statusCode || ![301, 302, 303, 307, 308].includes(statusCode) || !location) {
    return null;
  }
  let redirect: URL;
  try {
    redirect = new URL(location, requestedUri);
  } catch {
    return null;
  }
  if (redirect.protocol !== 'https:') return null;
  return new HTTPSRequiredError(requestedUri, redirect.toString(), statusCode);
}
```

Register this handler immediately after constructing the WebSocket:

```ts
this.ws.on('unexpected-response', (_request, response) => {
  const converted = this.httpsRequiredError(uri, actualUseSsl, response);
  const error = converted ?? new Error(`Unexpected server response: ${response.statusCode ?? 'unknown'}`);
  response.resume();
  if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
  this.connectTimeoutTimer = null;
  this.connected = false;
  this.ws = null;
  const rejectConnect = this.connectReject;
  this.connectReject = null;
  this.connectResolve = null;
  rejectConnect?.(error);
});
```

- [ ] **Step 5: Verify positive and negative cases are GREEN**

The Step 1 table covers status `401`, `302` without `Location`, and
`302 Location: http://...`; each must reject with an ordinary `Error`, not
`HTTPSRequiredError`. The direct helper assertion proves an attempt with
`actualUseSsl=true` cannot be converted.

Run:

```bash
npm run build && node --test dist/test/unit/https_required.test.js
```

Expected: all redirect and negative cases pass, and each server observes one request.

- [ ] **Step 6: Commit the connection error**

```bash
git add src/client.ts src/exceptions.ts src/index.ts src/test/unit/https_required.test.ts
git commit -m "feat: identify fnos https redirects"
```

---

### Task 3: Query validation and contract harness

**Files:**

- Create: `src/validation.ts`
- Create: `src/test/unit/validation.test.ts`
- Create: `src/test/unit/query_contract.ts`
- Create: `src/test/unit/query_cases.ts`
- Create: `src/test/unit/query_contract.test.ts`

**Interfaces:**

- Consumes: `FnosClient.requestPayloadWithResponse()`.
- Produces: reusable validators and the `QueryCase` interface consumed by unit and integration tests.

- [ ] **Step 1: Write validator tests**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyRecordList, requireNonEmptyString, requireNonNegativeInteger,
  requirePositiveInteger,
} from '../../validation.js';

describe('query validation', () => {
  it('rejects invalid scalar values', () => {
    for (const value of [null, '', '   ', 1]) {
      assert.throws(() => requireNonEmptyString('name', value as never));
    }
    for (const value of [0, -1, true, 1.5, '1']) {
      assert.throws(() => requirePositiveInteger('page', value as never));
    }
    for (const value of [-1, true, 1.5, '1']) {
      assert.throws(() => requireNonNegativeInteger('uid', value as never));
    }
  });

  it('copies a list and every record', () => {
    const source = [{ pid: 1001, process: 'example' }];
    const copy = copyRecordList('processes', source);
    assert.deepEqual(copy, source);
    assert.notEqual(copy, source);
    assert.notEqual(copy[0], source[0]);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run `npm run build`.

Expected: compile failure because `src/validation.ts` does not exist.

- [ ] **Step 3: Implement validators**

```ts
export function requireNonEmptyString(name: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name}参数不能为空字符串`);
  }
}

export function requirePositiveInteger(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name}参数必须是正整数`);
  }
}

export function requireNonNegativeInteger(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name}参数必须是非负整数`);
  }
}

export function copyRecordList(
  name: string,
  value: unknown,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.some((item) =>
    typeof item !== 'object' || item === null || Array.isArray(item))) {
    throw new TypeError(`${name}参数必须是对象列表`);
  }
  return value.map((item) => ({ ...(item as Record<string, unknown>) }));
}
```

- [ ] **Step 4: Add the query contract helper**

Create `src/test/unit/query_contract.ts`:

```ts
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
  const result = await query.invoke(client, 2500);
  assert.equal(result, sentinel);
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(request.mock.calls[0].arguments, [query.endpoint, query.payload, 2500]);
  request.mock.restore();
}
```

Create an initially empty exported array in `query_cases.ts` and a harness smoke
test in `query_contract.test.ts`:

```ts
import { describe, it } from 'node:test';
import { assertQueryCase } from './query_contract.js';

describe('query contract harness', () => {
  it('checks endpoint, payload, timeout, and identity response', () =>
    assertQueryCase({
      name: 'harness-smoke',
      endpoint: 'example.query',
      payload: { value: 1 },
      invoke: (client, timeout) =>
        client.requestPayloadWithResponse('example.query', { value: 1 }, timeout),
    }));
});
```

`query_cases.ts` contains `export const ALL_QUERY_CASES: QueryCase[] = [];` until
Tasks 4 and 5 populate the matrix.

- [ ] **Step 5: Verify validator and harness GREEN**

Run:

```bash
npm run build
node --test dist/test/unit/validation.test.js
node --test dist/test/unit/query_contract.test.js
```

Expected: validator and harness tests pass. No missing endpoint test is committed
until the corresponding production methods are implemented in Tasks 4 and 5.

- [ ] **Step 6: Commit the harness**

```bash
git add src/validation.ts src/test/unit/validation.test.ts src/test/unit/query_contract.ts src/test/unit/query_cases.ts src/test/unit/query_contract.test.ts
git commit -m "test: add extended query contract harness"
```

---
### Task 4: Extend the nine existing query domains

**Files:**

- Modify: `src/docker_manager.ts`
- Modify: `src/network.ts`
- Modify: `src/resource_monitor.ts`
- Modify: `src/file.ts`
- Modify: `src/store.ts`
- Modify: `src/user.ts`
- Modify: `src/share.ts`
- Modify: `src/sac.ts`
- Modify: `src/system_info.ts`
- Modify: `src/test/unit/query_cases.ts`
- Modify: `src/test/unit/query_contract.test.ts`

**Interfaces:**

- Consumes: validation helpers and `FnosClient.requestPayloadWithResponse()`.
- Produces: 52 public methods and 54 contract cases across existing classes.

- [ ] **Step 1: Populate the existing-domain contract matrix**

Add these imports and exact cases to `query_cases.ts`; every lambda passes `t`
as the final timeout argument:

```ts
import { DockerManager } from '../../docker_manager.js';
import { File } from '../../file.js';
import { Network } from '../../network.js';
import { ResourceMonitor } from '../../resource_monitor.js';
import { SAC } from '../../sac.js';
import { Share } from '../../share.js';
import { Store } from '../../store.js';
import { SystemInfo } from '../../system_info.js';
import { User } from '../../user.js';
import type { QueryCase } from './query_contract.js';

const q = (
  name: string,
  endpoint: string,
  payload: Record<string, unknown>,
  invoke: QueryCase['invoke'],
): QueryCase => ({ name, endpoint, payload, invoke });

export const EXISTING_QUERY_CASES: QueryCase[] = [
  q('docker-image-downloads', 'appcgi.dockermgr.imageDownloadList', {}, (c, t) => new DockerManager(c).listImageDownloads(t)),
  q('docker-images', 'appcgi.dockermgr.imageList', {}, (c, t) => new DockerManager(c).listImages(t)),
  q('docker-networks', 'appcgi.dockermgr.networkList', {}, (c, t) => new DockerManager(c).listNetworks(t)),
  q('docker-registry', 'appcgi.dockermgr.registryHubRepoList', { key: '', page: 1, pageSize: 20 }, (c, t) => new DockerManager(c).listRegistryRepositories('', 1, 20, t)),

  q('network-gateway', 'appcgi.network.gw.getting', {}, (c, t) => new Network(c).getGateway(t)),
  q('network-multi-gateway', 'appcgi.network.net.getMultiGWStatus', {}, (c, t) => new Network(c).getMultiGatewayStatus(t)),
  q('network-nic-performance', 'appcgi.network.net.getNicPerformanceMode', {}, (c, t) => new Network(c).getNicPerformanceMode(t)),
  q('network-info', 'appcgi.network.net.info', { ifName: 'eth0' }, (c, t) => new Network(c).getInfo('eth0', t)),
  q('network-ssh', 'appcgi.network.ssh.status', {}, (c, t) => new Network(c).getSshStatus(t)),

  q('resmon-npu', 'appcgi.resmon.npu', {}, (c, t) => new ResourceMonitor(c).npu(t)),
  q('resmon-processes', 'appcgi.resmon.proc.list', {}, (c, t) => new ResourceMonitor(c).processes(t)),
  q('resmon-service-processes', 'appcgi.resmon.proc.srv', {}, (c, t) => new ResourceMonitor(c).serviceProcesses(t)),
  q('resmon-system-fan', 'appcgi.resmon.sysFan', {}, (c, t) => new ResourceMonitor(c).systemFan(t)),

  q('file-app-directories', 'appcgi.filestor.getAppDirList', {}, (c, t) => new File(c).listAppDirectories(t)),
  q('file-favorites', 'file.fav.list', {}, (c, t) => new File(c).listFavorites(t)),
  q('file-directory-entries', 'file.lsDir', {}, (c, t) => new File(c).listDirectoryEntries(t)),
  q('file-recent', 'file.recent.list', {}, (c, t) => new File(c).listRecent(t)),
  q('file-shared', 'file.share.list', {}, (c, t) => new File(c).listShared(t)),
  q('file-shared-by-others', 'file.share.listOthers', {}, (c, t) => new File(c).listSharedByOthers(t)),
  q('file-team-trash', 'file.team.trash.listTrashbin', {}, (c, t) => new File(c).listTeamTrashBins(t)),
  q('file-trash', 'file.trash.list', {}, (c, t) => new File(c).listTrash(t)),

  q('store-cache-state', 'stor.cachedevState', {}, (c, t) => new Store(c).getCacheDeviceState(t)),
  q('store-disk-idle', 'stor.getDiskIdleTime', {}, (c, t) => new Store(c).getDiskIdleTime(t)),
  q('store-disk-wakeup', 'stor.getDiskWakeup', {}, (c, t) => new Store(c).getDiskWakeup(t)),
  q('store-removable-config', 'stor.getRemovableConf', {}, (c, t) => new Store(c).getRemovableConfig(t)),
  q('store-cache-devices', 'stor.listCachedev', {}, (c, t) => new Store(c).listCacheDevices(t)),
  q('store-removable-devices', 'stor.listRemovable', {}, (c, t) => new Store(c).listRemovableDevices(t)),

  q('user-tokens', 'appcgi.accountsrv.v1.token.list', { data: {} }, (c, t) => new User(c).listTokens(t)),
  q('user-my-twofa', 'appcgi.tfa.security.v1.me.getConfig', {}, (c, t) => new User(c).getMyTwofaConfig(t)),
  q('user-global-twofa', 'appcgi.tfa.security.v1.twofa.getConfig', {}, (c, t) => new User(c).getGlobalTwofaConfig(t)),
  q('user-twofa', 'appcgi.tfa.security.v1.user.getTwofaConfig', { data: { uid: 1000 } }, (c, t) => new User(c).getUserTwofaConfig(1000, t)),
  q('user-active', 'user.active', {}, (c, t) => new User(c).getActiveState(t)),
  q('user-group-info', 'user.groupInfo', { group: 'group' }, (c, t) => new User(c).getGroupInfo('group', t)),
  q('user-groups', 'user.groupList', {}, (c, t) => new User(c).listGroups(t)),
  q('user-login-devices', 'user.listLoginDevice', {}, (c, t) => new User(c).listLoginDevices(t)),
  q('user-preference-namesake', 'usrdat.get', { name: 'browser.namesakeConf' }, (c, t) => new User(c).getPreference('browser.namesakeConf', t)),
  q('user-preference-date', 'usrdat.get', { name: 'date-format' }, (c, t) => new User(c).getPreference('date-format', t)),

  q('share-dlna', 'appcgi.share.dlna.opt', {}, (c, t) => new Share(c).dlnaOptions(t)),
  q('share-dlna-share', 'appcgi.share.dlna.share.opt', {}, (c, t) => new Share(c).dlnaShareOptions(t)),
  q('share-ftp', 'appcgi.share.ftp.opt', {}, (c, t) => new Share(c).ftpOptions(t)),
  q('share-ftp-share', 'appcgi.share.ftp.share.opt', {}, (c, t) => new Share(c).ftpShareOptions(t)),
  q('share-nfs', 'appcgi.share.nfs.opt', {}, (c, t) => new Share(c).nfsOptions(t)),
  q('share-nfs-share', 'appcgi.share.nfs.share.opt', {}, (c, t) => new Share(c).nfsShareOptions(t)),
  q('share-smb-share', 'appcgi.share.smb.share.opt', {}, (c, t) => new Share(c).smbShareOptions(t)),
  q('share-webdav', 'appcgi.share.webdav.opt', {}, (c, t) => new Share(c).webdavOptions(t)),
  q('share-webdav-share', 'appcgi.share.webdav.share.opt', {}, (c, t) => new Share(c).webdavShareOptions(t)),
  q('share-link-defaults', 'appcgi.sharesvr.share.link.default.get', {}, (c, t) => new Share(c).getLinkDefaults(t)),
  q('share-default-link', 'appcgi.sharesvr.share.link.default', {}, (c, t) => new Share(c).getDefaultLink(t)),
  q('share-links-user', 'appcgi.sharesvr.share.link.list', { data: { isAdmin: false, keyword: '', page: 1, pageSize: 100, sortColumn: 'createdTime', sortType: 'DESC' } }, (c, t) => new Share(c).listLinks(false, '', 1, 100, 'createdTime', 'DESC', t)),
  q('share-links-admin', 'appcgi.sharesvr.share.link.list', { data: { isAdmin: true, keyword: '', page: 1, pageSize: 100, sortColumn: 'createdTime', sortType: 'DESC' } }, (c, t) => new Share(c).listLinks(true, '', 1, 100, 'createdTime', 'DESC', t)),
  q('share-link-permission', 'appcgi.sharesvr.share.permission.get', {}, (c, t) => new Share(c).getLinkPermission(t)),

  q('sac-email-config', 'appcgi.sac.externalnotify.v1.email.getConfig', {}, (c, t) => new SAC(c).getEmailConfig(t)),
  q('sac-email-providers', 'appcgi.sac.externalnotify.v1.email.getProviders', {}, (c, t) => new SAC(c).listEmailProviders(t)),
  q('system-reserved-partition', 'appcgi.sysinfo.getReservedPartition', {}, (c, t) => new SystemInfo(c).getReservedPartition(t)),
];

export const ALL_QUERY_CASES: QueryCase[] = [...EXISTING_QUERY_CASES];
```

At the same time, add these failing validation tests to
`query_contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DockerManager } from '../../docker_manager.js';
import { FnosClient } from '../../client.js';
import { Network } from '../../network.js';
import { Share } from '../../share.js';
import { User } from '../../user.js';
import { EXISTING_QUERY_CASES } from './query_cases.js';
import { assertQueryCase } from './query_contract.js';
```

```ts
it('rejects invalid existing-domain arguments before sending', async () => {
  const client = new FnosClient();
  await assert.rejects(new Network(client).getInfo(''));
  await assert.rejects(new User(client).getUserTwofaConfig(-1));
  await assert.rejects(new User(client).getGroupInfo('   '));
  await assert.rejects(new User(client).getPreference(''));
  await assert.rejects(new DockerManager(client).listRegistryRepositories('', 0));
  await assert.rejects(new Share(client).listLinks(false, '', 1, 0));
});
```

- [ ] **Step 2: Run the contract test and confirm method-level RED**

Run `npm run build`.

Expected: compile failures name every missing camelCase method in the matrix.

- [ ] **Step 3: Add Docker, network, resource, file, and store methods**

Import `requirePositiveInteger` into `docker_manager.ts` and append:

```ts
async listImageDownloads(timeout = 10000): Promise<any> {
  return this.client.requestPayloadWithResponse('appcgi.dockermgr.imageDownloadList', {}, timeout);
}
async listImages(timeout = 10000): Promise<any> {
  return this.client.requestPayloadWithResponse('appcgi.dockermgr.imageList', {}, timeout);
}
async listNetworks(timeout = 10000): Promise<any> {
  return this.client.requestPayloadWithResponse('appcgi.dockermgr.networkList', {}, timeout);
}
async listRegistryRepositories(keyword = '', page = 1, pageSize = 20, timeout = 10000): Promise<any> {
  requirePositiveInteger('page', page);
  requirePositiveInteger('pageSize', pageSize);
  return this.client.requestPayloadWithResponse(
    'appcgi.dockermgr.registryHubRepoList', { key: keyword, page, pageSize }, timeout,
  );
}
```

Import `requireNonEmptyString` into `network.ts` and append:

```ts
async getGateway(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.network.gw.getting', {}, timeout); }
async getMultiGatewayStatus(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.network.net.getMultiGWStatus', {}, timeout); }
async getNicPerformanceMode(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.network.net.getNicPerformanceMode', {}, timeout); }
async getInfo(ifName: string, timeout = 10000): Promise<any> {
  requireNonEmptyString('ifName', ifName);
  return this.client.requestPayloadWithResponse('appcgi.network.net.info', { ifName }, timeout);
}
async getSshStatus(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.network.ssh.status', {}, timeout); }
```

Append the exact empty-payload wrappers:

```ts
// ResourceMonitor
async npu(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.resmon.npu', {}, timeout); }
async processes(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.resmon.proc.list', {}, timeout); }
async serviceProcesses(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.resmon.proc.srv', {}, timeout); }
async systemFan(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.resmon.sysFan', {}, timeout); }

// File
async listAppDirectories(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.filestor.getAppDirList', {}, timeout); }
async listFavorites(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.fav.list', {}, timeout); }
async listDirectoryEntries(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.lsDir', {}, timeout); }
async listRecent(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.recent.list', {}, timeout); }
async listShared(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.share.list', {}, timeout); }
async listSharedByOthers(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.share.listOthers', {}, timeout); }
async listTeamTrashBins(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.team.trash.listTrashbin', {}, timeout); }
async listTrash(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('file.trash.list', {}, timeout); }

// Store
async getCacheDeviceState(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('stor.cachedevState', {}, timeout); }
async getDiskIdleTime(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('stor.getDiskIdleTime', {}, timeout); }
async getDiskWakeup(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('stor.getDiskWakeup', {}, timeout); }
async getRemovableConfig(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('stor.getRemovableConf', {}, timeout); }
async listCacheDevices(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('stor.listCachedev', {}, timeout); }
async listRemovableDevices(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('stor.listRemovable', {}, timeout); }
```

- [ ] **Step 4: Add user, share, SAC, and system methods**

Import `requireNonEmptyString` and `requireNonNegativeInteger` into `user.ts`:

```ts
async listTokens(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.accountsrv.v1.token.list', { data: {} }, timeout); }
async getMyTwofaConfig(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.tfa.security.v1.me.getConfig', {}, timeout); }
async getGlobalTwofaConfig(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.tfa.security.v1.twofa.getConfig', {}, timeout); }
async getUserTwofaConfig(uid: number, timeout = 10000): Promise<any> {
  requireNonNegativeInteger('uid', uid);
  return this.client.requestPayloadWithResponse('appcgi.tfa.security.v1.user.getTwofaConfig', { data: { uid } }, timeout);
}
async getActiveState(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('user.active', {}, timeout); }
async getGroupInfo(group: string, timeout = 10000): Promise<any> {
  requireNonEmptyString('group', group);
  return this.client.requestPayloadWithResponse('user.groupInfo', { group }, timeout);
}
async listGroups(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('user.groupList', {}, timeout); }
async listLoginDevices(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('user.listLoginDevice', {}, timeout); }
async getPreference(name: string, timeout = 10000): Promise<any> {
  requireNonEmptyString('name', name);
  return this.client.requestPayloadWithResponse('usrdat.get', { name }, timeout);
}
```

Import `requirePositiveInteger` into `share.ts` and append:

```ts
async dlnaOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.dlna.opt', {}, timeout); }
async dlnaShareOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.dlna.share.opt', {}, timeout); }
async ftpOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.ftp.opt', {}, timeout); }
async ftpShareOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.ftp.share.opt', {}, timeout); }
async nfsOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.nfs.opt', {}, timeout); }
async nfsShareOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.nfs.share.opt', {}, timeout); }
async smbShareOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.smb.share.opt', {}, timeout); }
async webdavOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.webdav.opt', {}, timeout); }
async webdavShareOptions(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.share.webdav.share.opt', {}, timeout); }
async getLinkDefaults(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sharesvr.share.link.default.get', {}, timeout); }
async getDefaultLink(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sharesvr.share.link.default', {}, timeout); }
async listLinks(
  isAdmin = false, keyword = '', page = 1, pageSize = 100,
  sortColumn = 'createdTime', sortType = 'DESC', timeout = 10000,
): Promise<any> {
  requirePositiveInteger('page', page);
  requirePositiveInteger('pageSize', pageSize);
  const data = { isAdmin, keyword, page, pageSize, sortColumn, sortType };
  return this.client.requestPayloadWithResponse('appcgi.sharesvr.share.link.list', { data }, timeout);
}
async getLinkPermission(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sharesvr.share.permission.get', {}, timeout); }
```

Append:

```ts
// SAC
async getEmailConfig(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sac.externalnotify.v1.email.getConfig', {}, timeout); }
async listEmailProviders(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sac.externalnotify.v1.email.getProviders', {}, timeout); }

// SystemInfo
async getReservedPartition(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sysinfo.getReservedPartition', {}, timeout); }
```

- [ ] **Step 5: Verify validation and the intermediate count**

Add a test asserting `EXISTING_QUERY_CASES.length === 54` and run every existing
case with `assertQueryCase()`. Do not add the final `82/71` assertion until Task 5.

```ts
describe('existing extended query contracts', () => {
  it('contains 54 captured request cases', () => {
    assert.equal(EXISTING_QUERY_CASES.length, 54);
  });
  for (const query of EXISTING_QUERY_CASES) {
    it(query.name, () => assertQueryCase(query));
  }
});
```

Run:

```bash
npm run build
node --test dist/test/unit/validation.test.js dist/test/unit/query_contract.test.js
```

Expected: all 54 existing-domain cases and validation tests pass.

- [ ] **Step 6: Commit existing domain queries**

```bash
git add src/docker_manager.ts src/network.ts src/resource_monitor.ts src/file.ts src/store.ts src/user.ts src/share.ts src/sac.ts src/system_info.ts src/test/unit/query_cases.ts src/test/unit/query_contract.test.ts
git commit -m "feat: extend existing query domains"
```

---

### Task 5: Add the nine new query domains

**Files:**

- Create: `src/backup_manager.ts`
- Create: `src/download_center.ts`
- Create: `src/ip_blocker.ts`
- Create: `src/license_manager.ts`
- Create: `src/live_update.ts`
- Create: `src/mount_manager.ts`
- Create: `src/network_server.ts`
- Create: `src/security.ts`
- Create: `src/system_restore.ts`
- Modify: `src/test/unit/query_cases.ts`
- Modify: `src/test/unit/query_contract.test.ts`

**Interfaces:**

- Consumes: `FnosClient`, `copyRecordList`, and positive integer validation.
- Produces: 19 public methods and 28 additional request cases, bringing totals to 71/82.

- [ ] **Step 1: Add all 28 failing contract cases**

Import the nine new classes into `query_cases.ts`, then add:

```ts
const PROCESSES = [
  { pid: 1001, process: 'example-process' },
  { pid: 1002, process: 'example-worker' },
];

export const NEW_QUERY_CASES: QueryCase[] = [
  q('backup-outbound', 'appcgi.backup.task.list', { direction: 0 }, (c, t) => new BackupManager(c).listTasks(0, t)),
  q('backup-inbound', 'appcgi.backup.task.list', { direction: 1 }, (c, t) => new BackupManager(c).listTasks(1, t)),
  q('download-save-dir', 'appcgi.downloadcenter.config.getDefaultSaveDir', {}, (c, t) => new DownloadCenter(c).getDefaultSaveDirectory(t)),
  q('download-stats', 'appcgi.downloadcenter.stat.all', {}, (c, t) => new DownloadCenter(c).getStatistics(t)),
  ...[16, 1, 2, 32, 4, 64, 65535, 8].map((stateFilter) =>
    q(`download-state-${stateFilter}`, 'appcgi.downloadcenter.task.query',
      { init_flag: true, state_filter: stateFilter },
      (c, t) => new DownloadCenter(c).queryTasks(stateFilter, true, t))),
  q('ip-allow', 'appcgi.ipblocker.queryAllowList', {}, (c, t) => new IPBlocker(c).listAllowedAddresses(t)),
  q('ip-auto-block', 'appcgi.ipblocker.queryAutoBlockRule', {}, (c, t) => new IPBlocker(c).getAutoBlockRule(t)),
  q('ip-deny', 'appcgi.ipblocker.queryDenyList', {}, (c, t) => new IPBlocker(c).listDeniedAddresses(t)),
  q('licenses', 'appcgi.license.soft.list', { data: { page: 1, pageSize: 200 } }, (c, t) => new LicenseManager(c).list(1, 200, t)),
  q('live-update', 'liveupdate.status', {}, (c, t) => new LiveUpdate(c).getStatus(t)),
  q('mounts', 'appcgi.mountmgr.list', {}, (c, t) => new MountManager(c).listMounts(t)),
  q('mount-settings', 'appcgi.mountmgr.setting.detail', {}, (c, t) => new MountManager(c).getSettings(t)),
  q('certificates', 'appcgi.netsvr.cert.list', {}, (c, t) => new NetworkServer(c).listCertificates(t)),
  q('connection-config', 'appcgi.netsvr.conn.getconfig', {}, (c, t) => new NetworkServer(c).getConnectionConfig(t)),
  q('connection-status', 'appcgi.netsvr.conn.status', {}, (c, t) => new NetworkServer(c).getConnectionStatus(t)),
  q('ddns-providers', 'appcgi.netsvr.ddns.provider.list', {}, (c, t) => new NetworkServer(c).listDdnsProviders(t)),
  q('ddns-records-default', 'appcgi.netsvr.ddns.record.list', { data: { page: 1, pageSize: 200 } }, (c, t) => new NetworkServer(c).listDdnsRecords(1, 200, t)),
  q('ddns-records-large', 'appcgi.netsvr.ddns.record.list', { data: { page: 1, pageSize: 999 } }, (c, t) => new NetworkServer(c).listDdnsRecords(1, 999, t)),
  q('firewall', 'appcgi.security.firewall.getting', {}, (c, t) => new Security(c).getFirewall(t)),
  q('process-traffic', 'appcgi.security.flowaudit.traffic', { data: PROCESSES }, (c, t) => new Security(c).getProcessTraffic(PROCESSES, t)),
  q('restore-info', 'appcgi.sysrestore.getInfo', {}, (c, t) => new SystemRestore(c).getInfo(t)),
];

export const ALL_QUERY_CASES = [...EXISTING_QUERY_CASES, ...NEW_QUERY_CASES];
```

Also add the failing validation and copy tests before any new class is created:

Update `query_contract.test.ts` imports to include `mock`, the nine new classes,
and `ALL_QUERY_CASES`:

```ts
import { describe, it, mock } from 'node:test';
import { BackupManager } from '../../backup_manager.js';
import { LicenseManager } from '../../license_manager.js';
import { NetworkServer } from '../../network_server.js';
import { Security } from '../../security.js';
import { ALL_QUERY_CASES, NEW_QUERY_CASES } from './query_cases.js';
```

```ts
it('validates new-domain arguments and copies processes', async () => {
  const client = new FnosClient();
  await assert.rejects(new BackupManager(client).listTasks(2));
  await assert.rejects(new LicenseManager(client).list(0));
  await assert.rejects(new NetworkServer(client).listDdnsRecords(1, 0));

  const source = [{ pid: 1001, process: 'example' }];
  const request = mock.method(client, 'requestPayloadWithResponse', async () => ({}));
  await new Security(client).getProcessTraffic(source);
  const sent = request.mock.calls[0].arguments[1] as { data: typeof source };
  assert.deepEqual(sent.data, source);
  assert.notEqual(sent.data, source);
  assert.notEqual(sent.data[0], source[0]);
});

it('contains 82 cases for 71 unique endpoints', () => {
  assert.equal(ALL_QUERY_CASES.length, 82);
  assert.equal(new Set(ALL_QUERY_CASES.map((query) => query.endpoint)).size, 71);
});

for (const query of NEW_QUERY_CASES) {
  it(query.name, () => assertQueryCase(query));
}
```

- [ ] **Step 2: Run and confirm new-class RED**

Run `npm run build`.

Expected: compile failures because all nine imported modules are absent.

- [ ] **Step 3: Implement backup, download, IP blocker, and security**

Each file imports `FnosClient`, stores it in the constructor, and implements:

```ts
// backup_manager.ts
export class BackupManager {
  constructor(private readonly client: FnosClient) {}
  async listTasks(direction: number, timeout = 10000): Promise<any> {
    if (direction !== 0 && direction !== 1) throw new RangeError('direction参数必须为0或1');
    return this.client.requestPayloadWithResponse('appcgi.backup.task.list', { direction }, timeout);
  }
}

// download_center.ts
export class DownloadCenter {
  constructor(private readonly client: FnosClient) {}
  async getDefaultSaveDirectory(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.downloadcenter.config.getDefaultSaveDir', {}, timeout); }
  async getStatistics(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.downloadcenter.stat.all', {}, timeout); }
  async queryTasks(stateFilter = 65535, initFlag = true, timeout = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse('appcgi.downloadcenter.task.query', { init_flag: initFlag, state_filter: stateFilter }, timeout);
  }
}

// ip_blocker.ts
export class IPBlocker {
  constructor(private readonly client: FnosClient) {}
  async listAllowedAddresses(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.ipblocker.queryAllowList', {}, timeout); }
  async getAutoBlockRule(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.ipblocker.queryAutoBlockRule', {}, timeout); }
  async listDeniedAddresses(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.ipblocker.queryDenyList', {}, timeout); }
}

// security.ts
export class Security {
  constructor(private readonly client: FnosClient) {}
  async getFirewall(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.security.firewall.getting', {}, timeout); }
  async getProcessTraffic(processes: Array<Record<string, unknown>>, timeout = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.security.flowaudit.traffic',
      { data: copyRecordList('processes', processes) },
      timeout,
    );
  }
}
```

- [ ] **Step 4: Implement license, update, mount, network server, and restore**

```ts
// license_manager.ts
export class LicenseManager {
  constructor(private readonly client: FnosClient) {}
  async list(page = 1, pageSize = 200, timeout = 10000): Promise<any> {
    requirePositiveInteger('page', page);
    requirePositiveInteger('pageSize', pageSize);
    return this.client.requestPayloadWithResponse('appcgi.license.soft.list', { data: { page, pageSize } }, timeout);
  }
}

// live_update.ts
export class LiveUpdate {
  constructor(private readonly client: FnosClient) {}
  async getStatus(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('liveupdate.status', {}, timeout); }
}

// mount_manager.ts
export class MountManager {
  constructor(private readonly client: FnosClient) {}
  async listMounts(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.mountmgr.list', {}, timeout); }
  async getSettings(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.mountmgr.setting.detail', {}, timeout); }
}

// network_server.ts
export class NetworkServer {
  constructor(private readonly client: FnosClient) {}
  async listCertificates(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.netsvr.cert.list', {}, timeout); }
  async getConnectionConfig(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.netsvr.conn.getconfig', {}, timeout); }
  async getConnectionStatus(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.netsvr.conn.status', {}, timeout); }
  async listDdnsProviders(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.netsvr.ddns.provider.list', {}, timeout); }
  async listDdnsRecords(page = 1, pageSize = 200, timeout = 10000): Promise<any> {
    requirePositiveInteger('page', page);
    requirePositiveInteger('pageSize', pageSize);
    return this.client.requestPayloadWithResponse('appcgi.netsvr.ddns.record.list', { data: { page, pageSize } }, timeout);
  }
}

// system_restore.ts
export class SystemRestore {
  constructor(private readonly client: FnosClient) {}
  async getInfo(timeout = 10000): Promise<any> { return this.client.requestPayloadWithResponse('appcgi.sysrestore.getInfo', {}, timeout); }
}
```

- [ ] **Step 5: Verify validation, input copies, and final cardinality**

Run:

```bash
npm run build
node --test dist/test/unit/query_contract.test.js dist/test/unit/validation.test.js
```

Expected: 82 cases pass, covering 71 unique endpoints; all validation tests pass.

- [ ] **Step 6: Commit new domains**

```bash
git add src/backup_manager.ts src/download_center.ts src/ip_blocker.ts src/license_manager.ts src/live_update.ts src/mount_manager.ts src/network_server.ts src/security.ts src/system_restore.ts src/test/unit/query_cases.ts src/test/unit/query_contract.test.ts
git commit -m "feat: add extended query domains"
```

---

### Task 6: Public exports and fixed-fixture integration coverage

**Files:**

- Modify: `src/index.ts`
- Create: `src/test/unit/index_exports.test.ts`
- Create: `src/test/integration/twofa.test.ts`
- Create: `src/test/integration/extended_queries.test.ts`
- Modify: `.github/workflows/integration-tests.yml`

**Interfaces:**

- Consumes: `ALL_QUERY_CASES`, all new domain classes, and mock-server 2FA fixtures.
- Produces: package-level imports and repeatable CI integration coverage pinned to one fixture corpus.

- [ ] **Step 1: Write failing package-export and integration tests**

Create `src/test/unit/index_exports.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '../../index.js';

describe('package exports', () => {
  it('exports every new query domain', () => {
    const names = [
      'BackupManager', 'DownloadCenter', 'IPBlocker', 'LicenseManager',
      'LiveUpdate', 'MountManager', 'NetworkServer', 'Security', 'SystemRestore',
    ] as const;
    for (const name of names) assert.equal(typeof sdk[name], 'function', name);
  });
});
```

Create `src/test/integration/extended_queries.test.ts`:

```ts
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
    const unique = new Map(ALL_QUERY_CASES.map((query) => [query.endpoint, query]));
    assert.equal(ALL_QUERY_CASES.length, 82);
    assert.equal(unique.size, 71);
    for (const [endpoint, query] of unique) {
      const result = await query.invoke(client, 20000) as Record<string, unknown>;
      assert.equal(typeof result, 'object', endpoint);
      assert.doesNotMatch(String(result.errmsg ?? ''), /Unknown request type/, endpoint);
    }
  });
});
```

Create `src/test/integration/twofa.test.ts`:

```ts
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FnosClient } from '../../client.js';

describe('two-factor login integration', () => {
  const client = new FnosClient();
  after(() => client.close());

  it('completes a bound 2FA challenge', async () => {
    await client.connect('127.0.0.1:5666', 20000);
    const challenge = await client.login('twofauser', 'admin', 20000);
    assert.equal(challenge.twofaRequired, true);
    assert.equal(challenge.twofaSetupRequired, false);
    assert.equal(typeof challenge.accessToken, 'string');
    const final = await client.submitTwofaCode('583213', true, 20000);
    assert.equal(final.result, 'succ');
    assert.equal(typeof final.token, 'string');
    assert.equal(typeof final.secret, 'string');
    assert.ok(client.getDecryptedSecret());
  });
});
```

- [ ] **Step 2: Run integration compile and verify RED**

Run `npm run build`.

Expected: compile failure in `index_exports.test.ts` because the nine classes are
not yet exported.

- [ ] **Step 3: Export the public surface**

Add to `src/index.ts` without changing `version`:

```ts
export { BackupManager } from './backup_manager.js';
export { DownloadCenter } from './download_center.js';
export { IPBlocker } from './ip_blocker.js';
export { LicenseManager } from './license_manager.js';
export { LiveUpdate } from './live_update.js';
export { MountManager } from './mount_manager.js';
export { NetworkServer } from './network_server.js';
export { Security } from './security.js';
export { SystemRestore } from './system_restore.js';
```

Keep the Task 2 export:

```ts
export { NotConnectedError, HTTPSRequiredError } from './exceptions.js';
```

Add a unit smoke assertion that each imported value is a constructor.

- [ ] **Step 4: Pin and configure fnos-mock-server in CI**

Replace the clone step with:

```yaml
- name: Clone fnos-mock-server
  env:
    FNOS_MOCK_SERVER_REF: d9592a05a8e07082b954921acfae3a9a915f3c01
  run: |
    git init ../fnos-mock-server
    cd ../fnos-mock-server
    git remote add origin https://github.com/Timandes/fnos-mock-server.git
    git fetch --depth 1 origin "$FNOS_MOCK_SERVER_REF"
    git checkout --detach FETCH_HEAD
```

Set Python explicitly and enable the 2FA fixture when starting the server:

```yaml
- name: Install mock server dependencies
  working-directory: ../fnos-mock-server
  run: uv sync --python 3.11

- name: Start mock server
  working-directory: ../fnos-mock-server
  env:
    FNOS_MOCK_TWOFA_USERS: twofauser
  run: |
    uv run --python 3.11 python -m server.main > /tmp/mock-server.log 2>&1 &
    echo $! > /tmp/mock-server.pid
```

- [ ] **Step 5: Run the fixed mock server and verify GREEN**

Start the pinned server locally, then run:

```bash
npm run build
npm run test:integration
```

Expected: ordinary login, bound 2FA, and all 71 unique endpoints pass. The test
must not contain unknown-request messages or timeouts.

- [ ] **Step 6: Commit integration coverage and exports**

```bash
git add src/index.ts src/test/unit/index_exports.test.ts src/test/integration/twofa.test.ts src/test/integration/extended_queries.test.ts .github/workflows/integration-tests.yml
git commit -m "test: cover extended queries with mock server"
```

---

### Task 7: Shared example authentication and runnable examples

**Files:**

- Create: `examples/common.ts`
- Create: `examples/twofa_login.ts`
- Create: `examples/https_required_error.ts`
- Create: `examples/backup_manager.ts`
- Create: `examples/download_center.ts`
- Create: `examples/ip_blocker.ts`
- Create: `examples/license_manager.ts`
- Create: `examples/live_update.ts`
- Create: `examples/mount_manager.ts`
- Create: `examples/network_server.ts`
- Create: `examples/security.ts`
- Create: `examples/system_restore.ts`
- Modify: `examples/docker_manager.ts`
- Modify: `examples/network.ts`
- Modify: `examples/resource_monitor.ts`
- Modify: `examples/file.ts`
- Modify: `examples/store.ts`
- Modify: `examples/user.ts`
- Modify: `examples/share.ts`
- Modify: `examples/sac.ts`
- Modify: `examples/system_info.ts`
- Create: `src/test/unit/examples_help.test.ts`

**Interfaces:**

- Consumes: package exports, `FnosClient.login()`, and `submitTwofaCode()`.
- Produces: common CLI auth parsing and examples whose `--help` path has no network side effects.

- [ ] **Step 1: Write the non-network help smoke test**

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const exec = promisify(execFile);
const examples = [
  'backup_manager.ts', 'download_center.ts', 'ip_blocker.ts',
  'license_manager.ts', 'live_update.ts', 'mount_manager.ts',
  'network_server.ts', 'security.ts', 'system_restore.ts',
  'twofa_login.ts', 'https_required_error.ts',
  'docker_manager.ts', 'network.ts', 'resource_monitor.ts', 'file.ts',
  'store.ts', 'user.ts', 'share.ts', 'sac.ts', 'system_info.ts',
];

describe('new example help', () => {
  for (const filename of examples) {
    it(`${filename} prints help without connecting`, async () => {
      const { stdout } = await exec(
        path.resolve('node_modules/.bin/tsx'),
        [path.resolve('examples', filename), '--help'],
      );
      assert.match(stdout, /Usage:/);
    });
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run build && node --test dist/test/unit/examples_help.test.js
```

Expected: the smoke test fails because the new example files do not exist.

- [ ] **Step 3: Implement `examples/common.ts`**

Use a small parser that does not require an external CLI package:

```ts
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { FnosClient, type LoginResponse } from '../src/index.js';

export interface AuthArgs {
  user: string;
  password: string;
  endpoint: string;
  code?: string;
  trustDevice: boolean;
  useSsl: boolean;
  skipSslVerify: boolean;
}

function value(argv: string[], long: string, short?: string): string | undefined {
  const index = argv.findIndex((item) => item === long || item === short);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function printAuthHelp(description: string): void {
  console.log(`Usage: tsx <example> --user USER --password PASSWORD [-e HOST:PORT] [options]\n\n${description}\n\nOptions:\n  --user USER\n  --password PASSWORD\n  -e, --endpoint HOST:PORT\n  --code 123456\n  --trust-device\n  --use-ssl\n  --skip-ssl-verify true|false\n  --help`);
}

export function parseAuthArgs(argv = process.argv.slice(2)): AuthArgs {
  const user = value(argv, '--user');
  const password = value(argv, '--password');
  if (!user || !password) throw new Error('--user 和 --password 为必填参数');
  return {
    user,
    password,
    endpoint: value(argv, '--endpoint', '-e') ?? 'your-custom-endpoint.com:5666',
    code: value(argv, '--code'),
    trustDevice: argv.includes('--trust-device'),
    useSsl: argv.includes('--use-ssl'),
    skipSslVerify: (value(argv, '--skip-ssl-verify') ?? 'true').toLowerCase() === 'true',
  };
}

export async function loginWithTwofa(client: FnosClient, args: AuthArgs): Promise<LoginResponse> {
  let result = await client.login(args.user, args.password);
  if (result.twofaRequired) {
    let code = args.code;
    if (!code) {
      const readline = createInterface({ input: stdin, output: stdout });
      try { code = await readline.question('请输入 6 位两步验证码: '); }
      finally { readline.close(); }
    }
    result = await client.submitTwofaCode(code, args.trustDevice);
  } else if (result.twofaSetupRequired) {
    throw new Error('该账号需要先绑定两步验证后才能继续登录');
  }
  if (result.result !== 'succ') throw new Error(result.msg ?? result.errmsg ?? '登录失败');
  return result;
}

export async function runAuthenticatedExample(
  description: string,
  operation: (client: FnosClient) => Promise<void>,
  argv = process.argv.slice(2),
): Promise<void> {
  if (argv.includes('--help')) return printAuthHelp(description);
  const args = parseAuthArgs(argv);
  const client = new FnosClient();
  try {
    await client.connect(args.endpoint, 3000, args.useSsl, args.skipSslVerify);
    await loginWithTwofa(client, args);
    await operation(client);
  } finally {
    client.close();
  }
}
```

- [ ] **Step 4: Add 2FA and HTTPS diagnostic examples**

`examples/twofa_login.ts`:

```ts
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('两步验证登录示例', async (client) => {
  console.log('登录成功:', client.isConnected());
}).catch((error) => { console.error(error); process.exitCode = 1; });
```

`examples/https_required_error.ts`:

```ts
import { FnosClient, HTTPSRequiredError } from '../src/index.js';

async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.includes('--help')) {
    console.log('Usage: tsx examples/https_required_error.ts -e HOST:PORT');
    return 0;
  }
  const index = argv.findIndex((item) => item === '-e' || item === '--endpoint');
  if (index < 0 || !argv[index + 1]) throw new Error('-e/--endpoint 为必填参数');
  const client = new FnosClient();
  try {
    await client.connect(argv[index + 1]);
    console.log('未检测到强制 HTTPS 重定向');
    return 0;
  } catch (error) {
    if (!(error instanceof HTTPSRequiredError)) throw error;
    const suggested = new URL(error.redirectUri);
    suggested.protocol = 'wss:';
    console.log(`状态码: ${error.statusCode}`);
    console.log(`原始请求: ${error.requestedUri}`);
    console.log(`重定向: ${error.redirectUri}`);
    console.log(`建议 WSS: ${suggested}`);
    console.log('SDK 未自动重试');
    return 0;
  } finally {
    client.close();
  }
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error); process.exitCode = 1;
});
```

- [ ] **Step 5: Add the nine new domain examples**

Create the nine files with this complete source pattern and the exact operations
shown below:

```ts
// examples/backup_manager.ts
import { BackupManager } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('备份任务查询', async (client) => {
  const api = new BackupManager(client);
  console.log('outbound', await api.listTasks(0));
  console.log('inbound', await api.listTasks(1));
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/download_center.ts
import { DownloadCenter } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('下载中心查询', async (client) => {
  const api = new DownloadCenter(client);
  console.log('saveDirectory', await api.getDefaultSaveDirectory());
  console.log('statistics', await api.getStatistics());
  console.log('tasks', await api.queryTasks());
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/ip_blocker.ts
import { IPBlocker } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('IP 阻止规则查询', async (client) => {
  const api = new IPBlocker(client);
  console.log('allowed', await api.listAllowedAddresses());
  console.log('autoBlock', await api.getAutoBlockRule());
  console.log('denied', await api.listDeniedAddresses());
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/license_manager.ts
import { LicenseManager } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('软件许可查询', async (client) => {
  console.log('licenses', await new LicenseManager(client).list());
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/live_update.ts
import { LiveUpdate } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('在线更新状态查询', async (client) => {
  console.log('status', await new LiveUpdate(client).getStatus());
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/mount_manager.ts
import { MountManager } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('挂载查询', async (client) => {
  const api = new MountManager(client);
  console.log('mounts', await api.listMounts());
  console.log('settings', await api.getSettings());
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/network_server.ts
import { NetworkServer } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('网络服务查询', async (client) => {
  const api = new NetworkServer(client);
  console.log('certificates', await api.listCertificates());
  console.log('connectionConfig', await api.getConnectionConfig());
  console.log('connectionStatus', await api.getConnectionStatus());
  console.log('ddnsProviders', await api.listDdnsProviders());
  console.log('ddnsRecords', await api.listDdnsRecords());
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/security.ts
import { Security } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('安全状态查询', async (client) => {
  const api = new Security(client);
  console.log('firewall', await api.getFirewall());
  console.log('traffic', await api.getProcessTraffic([{ pid: 1, process: 'example' }]));
}).catch((error) => { console.error(error); process.exitCode = 1; });

// examples/system_restore.ts
import { SystemRestore } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';
runAuthenticatedExample('系统恢复信息查询', async (client) => {
  console.log('restore', await new SystemRestore(client).getInfo());
}).catch((error) => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 6: Extend the nine existing examples with every new method**

Inside each example's existing authenticated client scope, add the exact calls:

```ts
// docker_manager.ts
await docker.listImageDownloads(); await docker.listImages();
await docker.listNetworks(); await docker.listRegistryRepositories();

// network.ts
await network.getGateway(); await network.getMultiGatewayStatus();
await network.getNicPerformanceMode(); await network.getInfo('eth0');
await network.getSshStatus();

// resource_monitor.ts
await monitor.npu(); await monitor.processes();
await monitor.serviceProcesses(); await monitor.systemFan();

// file.ts
await file.listAppDirectories(); await file.listFavorites();
await file.listDirectoryEntries(); await file.listRecent();
await file.listShared(); await file.listSharedByOthers();
await file.listTeamTrashBins(); await file.listTrash();

// store.ts
await store.getCacheDeviceState(); await store.getDiskIdleTime();
await store.getDiskWakeup(); await store.getRemovableConfig();
await store.listCacheDevices(); await store.listRemovableDevices();

// user.ts
await user.listTokens(); await user.getMyTwofaConfig();
await user.getGlobalTwofaConfig(); await user.getUserTwofaConfig(0);
await user.getActiveState(); await user.getGroupInfo('users');
await user.listGroups(); await user.listLoginDevices();
await user.getPreference('date-format');

// share.ts
await share.dlnaOptions(); await share.dlnaShareOptions();
await share.ftpOptions(); await share.ftpShareOptions();
await share.nfsOptions(); await share.nfsShareOptions();
await share.smbShareOptions(); await share.webdavOptions();
await share.webdavShareOptions(); await share.getLinkDefaults();
await share.getDefaultLink(); await share.listLinks();
await share.getLinkPermission();

// sac.ts
await sac.getEmailConfig(); await sac.listEmailProviders();

// system_info.ts
await systemInfo.getReservedPartition();
```

Also route these files through `loginWithTwofa()` so their username/password
flows work with bound 2FA accounts. In each existing `main()` replace its direct
login block with:

```ts
if (process.argv.slice(2).includes('--help')) {
  printAuthHelp('当前示例的 fnOS 只读查询');
  return;
}
const authArgs = parseAuthArgs();
await client.connect(
  authArgs.endpoint, 3000, authArgs.useSsl, authArgs.skipSslVerify,
);
await loginWithTwofa(client, authArgs);
```

Import `parseAuthArgs`, `printAuthHelp`, and `loginWithTwofa` from
`./common.js`; retain each file's current domain-specific argument parsing only
for arguments not present in `AuthArgs`.

- [ ] **Step 7: Run example smoke tests and commit**

Run:

```bash
npm run build
node --test dist/test/unit/examples_help.test.js
```

Expected: all new examples print help with exit code `0`; no connection is attempted.

```bash
git add examples src/test/unit/examples_help.test.ts
git commit -m "docs: add extended query examples"
```

---

### Task 8: Disk temperature diagnostic tool

**Files:**

- Create: `tools/common.ts`
- Create: `tools/list_disk_temperatures.ts`
- Create: `tools/test/common.test.ts`
- Create: `tools/test/list_disk_temperatures.test.ts`
- Create: `tsconfig.extras.json`
- Modify: `package.json:7-14`

**Interfaces:**

- Consumes: `FnosClient`, `Store.listDisks()`, `Store.getDiskSmart()`, and `ResourceMonitor.disk()`.
- Produces: a standalone `tsx` CLI, pure collection/formatting functions, and a separate tool test command.

- [ ] **Step 1: Write failing collection and redaction tests**

Create `tools/test/list_disk_temperatures.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDiskTemperatures, formatDiskTemperatures, redact, run,
  type ToolDependencies,
} from '../list_disk_temperatures.js';
import type { ToolArgs } from '../common.js';

describe('disk temperature diagnostic', () => {
  it('uses monitor temperature without SMART', async () => {
    let smartCalls = 0;
    const store = {
      listDisks: async () => ({ disk: [{ name: 'sda' }] }),
      getDiskSmart: async () => { smartCalls += 1; return {}; },
    };
    const monitor = { disk: async () => ({ data: { disk: [{ name: 'sda', temp: 42 }] } }) };
    const result = await collectDiskTemperatures(store, monitor);
    assert.deepEqual(result, [{ name: 'sda', temperature: 42, source: 'ResourceMonitor.disk().data.disk[].temp', skipped: [] }]);
    assert.equal(smartCalls, 0);
  });

  it('falls back from zero monitor and missing SATA SMART to NVMe', async () => {
    const store = {
      listDisks: async () => ({ disk: [{ name: 'nvme0n1' }] }),
      getDiskSmart: async () => ({ smart: { nvme_smart_health_information_log: { temperature: 51 } } }),
    };
    const monitor = { disk: async () => ({ data: { disk: [{ name: 'nvme0n1', temp: 0 }] } }) };
    const [result] = await collectDiskTemperatures(store, monitor);
    assert.equal(result.temperature, 51);
    assert.match(result.skipped.join('\n'), /值为 0/);
    assert.match(result.skipped.join('\n'), /字段不存在/);
    assert.match(formatDiskTemperatures([result]), /nvme0n1 => 51°C/);
  });

  it('isolates monitor and per-disk SMART failures', async () => {
    const store = {
      listDisks: async () => ({ disk: [{ name: 'sda' }, { name: 'sdb' }] }),
      getDiskSmart: async (name: string) => {
        if (name === 'sda') throw new Error('SMART unavailable');
        return { smart: { temperature: { current: 39 } } };
      },
    };
    const monitor = { disk: async () => { throw new Error('monitor unavailable'); } };
    const result = await collectDiskTemperatures(store, monitor);
    assert.equal(result[0].temperature, undefined);
    assert.equal(result[1].temperature, 39);
    assert.match(result[0].skipped.join('\n'), /monitor unavailable/);
    assert.match(result[0].skipped.join('\n'), /SMART unavailable/);
  });

  it('redacts exact values and authentication fields', () => {
    const text = 'password=secret token: abc accessToken="xyz" code=583213';
    const result = redact(text, ['secret', '583213']);
    assert.doesNotMatch(result, /secret|abc|xyz|583213/);
    assert.match(result, /\*\*\*/);
  });

  it('reports the failing stage, redacts credentials, and closes', async () => {
    const errors: string[] = [];
    let closed = false;
    const args: ToolArgs = {
      user: 'alice', password: 'password', endpoint: 'nas.example.com:5666',
      code: '583213', trustDevice: false, useSsl: false,
      skipSslVerify: true, debug: false,
    };
    const client = {
      connect: async () => true,
      login: async () => { throw new Error('token=abc password=password code=583213'); },
      close: () => { closed = true; },
    };
    const dependencies: ToolDependencies = {
      createClient: () => client as never,
      createStore: () => ({ listDisks: async () => ({ disk: [] }), getDiskSmart: async () => ({}) }),
      createMonitor: () => ({ disk: async () => ({ data: { disk: [] } }) }),
      log: () => undefined,
      error: (message) => { errors.push(message); },
    };
    assert.equal(await run(args, dependencies), 1);
    assert.equal(closed, true);
    assert.match(errors.join('\n'), /登录或两步验证阶段失败/);
    assert.doesNotMatch(errors.join('\n'), /abc|password=password|583213/);
  });
});
```

Create `tools/test/common.test.ts` before implementing `tools/common.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FnosClient } from '../../src/index.js';
import { connectClient, loginWithTwofa, type ToolArgs } from '../common.js';

const args: ToolArgs = {
  user: 'alice', password: 'password', endpoint: 'nas.example.com:5666',
  code: '583213', trustDevice: true, useSsl: true,
  skipSslVerify: false, debug: false,
};

describe('tool authentication', () => {
  it('passes connection options unchanged', async () => {
    const calls: unknown[][] = [];
    const client = {
      connect: async (...values: unknown[]) => { calls.push(values); return true; },
    } as unknown as FnosClient;
    await connectClient(client, args);
    assert.deepEqual(calls, [['nas.example.com:5666', 3000, true, false]]);
  });

  it('submits a supplied 2FA code and trust flag', async () => {
    const submissions: unknown[][] = [];
    const client = {
      login: async () => ({ result: 'succ', twofaRequired: true }),
      submitTwofaCode: async (...values: unknown[]) => {
        submissions.push(values);
        return { result: 'succ', token: 'token', secret: 'secret' };
      },
    } as unknown as FnosClient;
    const result = await loginWithTwofa(client, args);
    assert.equal(result.result, 'succ');
    assert.deepEqual(submissions, [['583213', true]]);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm exec -- tsx --test tools/test/*.test.ts
```

Expected: module-not-found failures for `tools/common.ts` and
`tools/list_disk_temperatures.ts`.

- [ ] **Step 3: Implement tool authentication helpers**

Create `tools/common.ts` with the same argument names as examples and an explicit
connection boundary:

```ts
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { FnosClient, type LoginResponse } from '../src/index.js';

export interface ToolArgs {
  user: string;
  password: string;
  endpoint: string;
  code?: string;
  trustDevice: boolean;
  useSsl: boolean;
  skipSslVerify: boolean;
  debug: boolean;
}

function value(argv: string[], long: string, short?: string): string | undefined {
  const index = argv.findIndex((item) => item === long || item === short);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseToolArgs(argv = process.argv.slice(2)): ToolArgs {
  const user = value(argv, '--user');
  const password = value(argv, '--password');
  if (!user || !password) throw new Error('--user 和 --password 为必填参数');
  return {
    user, password,
    endpoint: value(argv, '--endpoint', '-e') ?? 'your-custom-endpoint.com:5666',
    code: value(argv, '--code'),
    trustDevice: argv.includes('--trust-device'),
    useSsl: argv.includes('--use-ssl'),
    skipSslVerify: (value(argv, '--skip-ssl-verify') ?? 'true').toLowerCase() === 'true',
    debug: argv.includes('--debug'),
  };
}

export async function connectClient(client: FnosClient, args: ToolArgs): Promise<void> {
  await client.connect(args.endpoint, 3000, args.useSsl, args.skipSslVerify);
}

export async function loginWithTwofa(client: FnosClient, args: ToolArgs): Promise<LoginResponse> {
  let result = await client.login(args.user, args.password);
  if (result.twofaRequired) {
    let code = args.code;
    if (!code) {
      const readline = createInterface({ input: stdin, output: stdout });
      try { code = await readline.question('请输入 6 位两步验证码: '); }
      finally { readline.close(); }
    }
    result = await client.submitTwofaCode(code, args.trustDevice);
  } else if (result.twofaSetupRequired) {
    throw new Error('该账号需要先绑定两步验证后才能继续登录');
  }
  if (result.result !== 'succ') throw new Error(result.msg ?? result.errmsg ?? '登录失败');
  return result;
}
```

- [ ] **Step 4: Implement pure temperature collection and formatting**

Create these types and helpers in `tools/list_disk_temperatures.ts`:

```ts
import { FnosClient, ResourceMonitor, Store } from '../src/index.js';
import { connectClient, loginWithTwofa, parseToolArgs, type ToolArgs } from './common.js';

export const MONITOR_SOURCE = 'ResourceMonitor.disk().data.disk[].temp';
export const SMART_SOURCE = 'Store.getDiskSmart().smart.temperature.current';
export const NVME_SOURCE = 'Store.getDiskSmart().smart.nvme_smart_health_information_log.temperature';
const MISSING = Symbol('missing');

export interface DiskTemperature {
  name: string;
  temperature?: number;
  source?: string;
  skipped: string[];
}

interface StoreLike {
  listDisks(): Promise<unknown>;
  getDiskSmart(name: string): Promise<unknown>;
}
interface MonitorLike { disk(): Promise<unknown>; }

function nested(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) return MISSING;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function temperatureProblem(value: unknown): string | undefined {
  if (value === MISSING) return '字段不存在';
  if (typeof value !== 'number') return '不是数字';
  if (!Number.isFinite(value)) return '不是有限数值';
  if (value === 0) return '值为 0';
  return undefined;
}

function tryTemperature(result: DiskTemperature, source: string, value: unknown): boolean {
  const problem = temperatureProblem(value);
  if (problem) {
    result.skipped.push(`${source}${value === MISSING ? '' : ` = ${String(value)}`}（${problem}）`);
    return false;
  }
  result.temperature = value as number;
  result.source = source;
  return true;
}

function diskNames(response: unknown): string[] {
  const disks = nested(response, 'disk');
  if (!Array.isArray(disks)) throw new TypeError('Store.listDisks() 响应缺少 disk 列表');
  return disks.map((disk) => {
    const name = nested(disk, 'name');
    if (typeof name !== 'string' || !name) throw new TypeError('Store.listDisks() 返回了无效磁盘名称');
    return name;
  });
}

export async function collectDiskTemperatures(
  store: StoreLike,
  monitor: MonitorLike,
): Promise<DiskTemperature[]> {
  const names = diskNames(await store.listDisks());
  let monitorValues = new Map<string, unknown>();
  let monitorProblem: string | undefined;
  try {
    const disks = nested(await monitor.disk(), 'data', 'disk');
    if (!Array.isArray(disks)) {
      monitorProblem = 'ResourceMonitor.disk().data.disk（字段不存在或不是列表）';
    } else {
      for (const disk of disks) {
        const name = nested(disk, 'name');
        if (typeof name === 'string' && !monitorValues.has(name)) {
          monitorValues.set(name, nested(disk, 'temp'));
        }
      }
    }
  } catch (error) {
    monitorProblem = `ResourceMonitor.disk()（接口调用失败: ${errorSummary(error)}）`;
  }

  const results: DiskTemperature[] = [];
  for (const name of names) {
    const result: DiskTemperature = { name, skipped: [] };
    if (monitorProblem) result.skipped.push(monitorProblem);
    else if (!monitorValues.has(name)) result.skipped.push('ResourceMonitor.disk()（未找到该磁盘）');
    else if (tryTemperature(result, MONITOR_SOURCE, monitorValues.get(name))) {
      results.push(result); continue;
    }

    let smart: unknown;
    try { smart = await store.getDiskSmart(name); }
    catch (error) {
      result.skipped.push(`Store.getDiskSmart(${JSON.stringify(name)})（接口调用失败: ${errorSummary(error)}）`);
      results.push(result); continue;
    }
    if (!tryTemperature(result, SMART_SOURCE, nested(smart, 'smart', 'temperature', 'current'))) {
      tryTemperature(result, NVME_SOURCE, nested(smart, 'smart', 'nvme_smart_health_information_log', 'temperature'));
    }
    results.push(result);
  }
  return results;
}

export function formatDiskTemperatures(results: DiskTemperature[]): string {
  return results.map((item) => {
    const heading = `${item.name} => ${item.temperature === undefined ? '未知' : `${item.temperature}°C`}`;
    return [heading, item.source ? `  来源: ${item.source}` : '', ...item.skipped.map((reason) => `  跳过: ${reason}`)]
      .filter(Boolean).join('\n');
  }).join('\n\n');
}
```

- [ ] **Step 5: Add redacted error reporting and CLI orchestration**

Add:

```ts
const AUTH_FIELD = /((?:accessToken|longToken|token|secret|password|code)\s*[:=]\s*)(["']?)[^,\s}\]]+\2/gi;

export function redact(text: string, sensitive: unknown[] = []): string {
  let result = text;
  for (const value of sensitive) {
    if (value !== undefined && String(value)) result = result.split(String(value)).join('***');
  }
  return result.replace(AUTH_FIELD, '$1***');
}

function errorSummary(error: unknown): string {
  const value = error instanceof Error ? error : new Error(String(error));
  return `${value.name}: ${value.message.trim() || '无详细信息'}`;
}

export interface ToolDependencies {
  createClient(): FnosClient;
  createStore(client: FnosClient): StoreLike;
  createMonitor(client: FnosClient): MonitorLike;
  log(message: string): void;
  error(message: string): void;
}

const DEFAULT_DEPENDENCIES: ToolDependencies = {
  createClient: () => new FnosClient(),
  createStore: (client) => new Store(client),
  createMonitor: (client) => new ResourceMonitor(client),
  log: console.log,
  error: console.error,
};

export async function run(
  args: ToolArgs,
  dependencies: ToolDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  const client = dependencies.createClient();
  let stage = '连接';
  try {
    await connectClient(client, args);
    stage = '登录或两步验证';
    await loginWithTwofa(client, args);
    stage = '磁盘枚举与温度获取';
    const result = await collectDiskTemperatures(
      dependencies.createStore(client), dependencies.createMonitor(client),
    );
    dependencies.log(formatDiskTemperatures(result));
    return 0;
  } catch (error) {
    const value = error instanceof Error ? error : new Error(String(error));
    const sensitive = [args.password, args.code];
    dependencies.error(`错误: ${stage}阶段失败`);
    dependencies.error(`异常类型: ${value.name}`);
    dependencies.error(`异常详情: ${redact(value.message || '无详细信息', sensitive)}`);
    if (args.debug) dependencies.error(redact(value.stack ?? value.message, sensitive));
    else dependencies.error('提示: 使用 --debug 查看完整堆栈');
    return 1;
  } finally {
    client.close();
  }
}
```

Use this executable tail:

```ts
function printHelp(): void {
  console.log('Usage: tsx tools/list_disk_temperatures.ts --user USER --password PASSWORD [-e HOST:PORT] [--code 123456] [--trust-device] [--use-ssl] [--skip-ssl-verify true|false] [--debug]');
}

const isDirectExecution = /list_disk_temperatures\.(?:ts|js)$/.test(process.argv[1] ?? '');
if (isDirectExecution) {
  if (process.argv.slice(2).includes('--help')) {
    printHelp();
  } else {
    run(parseToolArgs())
      .then((code) => { process.exitCode = code; })
      .catch((error) => { console.error(redact(String(error))); process.exitCode = 1; });
  }
}
```

- [ ] **Step 6: Add the tool test script and verify GREEN**

Create `tsconfig.extras.json` so examples and tools receive strict type checking:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "rootDir": "." },
  "include": ["src/**/*.ts", "examples/**/*.ts", "tools/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Change package scripts to include the extra type check and make the full test
command cover tools:

```json
"check:extras": "tsc -p tsconfig.extras.json",
"test:tools": "tsx --test tools/test/*.test.ts",
"tool:disk-temperatures": "tsx tools/list_disk_temperatures.ts",
"test": "find dist/test -name '*.test.js' -type f | xargs node --test && npm run test:tools"
```

Run:

```bash
npm run test:tools
npm run check:extras
npm run tool:disk-temperatures -- --help
```

Expected: tool unit tests pass; help lists endpoint, SSL, 2FA, trust-device, and
debug options without attempting a connection.

- [ ] **Step 7: Commit the diagnostic tool**

```bash
git add tools package.json tsconfig.extras.json
git commit -m "feat: add disk temperature diagnostic tool"
```

---

### Task 9: Documentation, changelog, and final verification

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `TESTING_GUIDE.md`
- Create: `src/test/unit/documentation.test.ts`

**Interfaces:**

- Consumes: final public exports, examples, CLI scripts, and fixed integration commands.
- Produces: user-facing usage documentation and evidence that all design criteria pass.

- [ ] **Step 1: Write failing documentation consistency tests**

```ts
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('synchronized documentation', () => {
  it('documents the new public capabilities', async () => {
    const readme = await readFile('README.md', 'utf8');
    for (const text of [
      'submitTwofaCode', 'HTTPSRequiredError', 'BackupManager', 'DownloadCenter',
      'IPBlocker', 'LicenseManager', 'LiveUpdate', 'MountManager',
      'NetworkServer', 'Security', 'SystemRestore', 'list_disk_temperatures',
    ]) assert.match(readme, new RegExp(text));
  });

  it('keeps the package version and records Unreleased changes', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const changelog = await readFile('CHANGELOG.md', 'utf8');
    assert.equal(pkg.version, '0.3.0');
    assert.match(changelog, /## \[Unreleased\]/);
    assert.match(changelog, /71 个只读查询/);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run build && node --test dist/test/unit/documentation.test.js
```

Expected: README and Changelog assertions fail because the new surface is not documented.

- [ ] **Step 3: Update README with exact public behavior**

Add these sections:

- 2FA flow showing `login()`, `twofaRequired`, `submitTwofaCode()`, and
  `twofaSetupRequired`.
- `HTTPSRequiredError` catch example that manually suggests WSS without claiming
  automatic retry.
- API tables grouped by all 18 extended/new domain classes, using the method
  inventory from the approved design.
- Commands for all new examples and
  `npm run tool:disk-temperatures -- --user ... --password ... -e ...`.
- A note that the seven response-only endpoints remain intentionally unsupported.

- [ ] **Step 4: Update Changelog and testing guide**

Add a top-level `## [Unreleased]` with:

```md
### Added
- 新增两步验证登录流程与 `submitTwofaCode()`。
- 新增 `HTTPSRequiredError`，识别 fnOS 强制 HTTPS 重定向。
- 新增 9 个领域类，并扩展 9 个现有领域类，覆盖 71 个只读查询端点。
- 新增磁盘温度诊断工具，支持资源监控、SMART 和 NVMe SMART 回退。

### Changed
- 最终登录成功不再依赖可选的 `longToken`。
- 集成测试固定使用 fnos-mock-server `d9592a05a8e07082b954921acfae3a9a915f3c01`。
```

Update `TESTING_GUIDE.md` with the unit, tools, and fixed mock-server commands;
state that integration tests need Python 3.11, `uv`, port 5666, and
`FNOS_MOCK_TWOFA_USERS=twofauser`.

- [ ] **Step 5: Run documentation tests and full offline verification**

Run:

```bash
npm run build
npm run test:unit
npm run test:tools
npm run check:extras
git diff --check
```

Expected: SDK build, offline tests, tool tests, and extra-source type checking pass;
`git diff --check` prints nothing.

- [ ] **Step 6: Run fixed-server integration verification**

With fnos-mock-server commit `d9592a05a8e07082b954921acfae3a9a915f3c01`
running on `127.0.0.1:5666` with `FNOS_MOCK_TWOFA_USERS=twofauser`, run:

```bash
npm run test:integration
```

Expected: all integration tests pass, including 2FA and all 71 unique endpoints.

- [ ] **Step 7: Inspect scope and commit documentation**

Run:

```bash
git status --short
git diff --stat HEAD
git diff --check
```

Confirm that npm version remains `0.3.0`, no deferred endpoint appears in `src/`,
and no commit message or staged content contains `Co-Authored-By`.

```bash
git add README.md CHANGELOG.md TESTING_GUIDE.md src/test/unit/documentation.test.ts
git commit -m "docs: document pyfnos main parity"
```

- [ ] **Step 8: Apply completion verification skill**

Read and follow `superpowers:verification-before-completion`, rerun the commands
it requires against the final tree, and report exact pass counts plus any tests
that could not run. Do not claim completion from earlier output.

---

## Execution Checkpoints

- After Task 2: core connection/authentication review.
- After Task 5: 71/82 query parity and validation review.
- After Task 8: examples/tool security and credential-redaction review.
- After Task 9: full diff, offline tests, and fixed-server integration review.
