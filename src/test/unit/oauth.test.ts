import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FnosOAuthAdapter } from '../../oauth_adapter.js';
import { FnosOAuthClient } from '../../oauth_client.js';
import { User } from '../../user.js';

const endpoint = 'http://nas.example:5666';
const deviceId = 'test-device-id';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('FnosOAuthAdapter', () => {
  it('creates a PKCE authorization URL without redirect_uri', async () => {
    const adapter = new FnosOAuthAdapter({ endpoint, deviceId, allowInsecureHttp: true });
    const pending = await adapter.createAuthorizationRequest();
    const url = new URL(pending.url);
    assert.equal(url.pathname, '/signin');
    assert.equal(url.searchParams.get('client_id'), 'YJNMPJUGA9');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('device_id'), deviceId);
    assert.equal(url.searchParams.has('redirect_uri'), false);
    assert.ok(pending.url.includes('scope=trim.user.all%20trim.file.read'));
    assert.equal(pending.url.includes('+'), false);
    assert.match(pending.codeVerifier, /^[A-Za-z0-9_-]{43,}$/);
    assert.equal(url.searchParams.get('code_challenge')?.length, 43);
  });

  it('exchanges a code using fnOS fields and parses its envelope', async () => {
    let request: Record<string, unknown> | undefined;
    const adapter = new FnosOAuthAdapter({
      endpoint, deviceId, allowInsecureHttp: true,
      fetch: async (input, init) => {
        assert.equal(String(input), `${endpoint}/oauthapi/third-part/token`);
        request = JSON.parse(String(init?.body));
        return jsonResponse({ code: 0, msg: 'ok', data: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 } });
      },
    });
    const pending = await adapter.createAuthorizationRequest();
    const session = await adapter.exchangeCode('one-time-code', pending);
    assert.deepEqual(Object.keys(request ?? {}).sort(), ['client_id', 'code', 'code_verifier', 'device_id', 'device_model', 'device_name', 'device_os']);
    assert.equal(request?.code_verifier, pending.codeVerifier);
    assert.equal(session.accessToken, 'access');
    assert.equal(session.refreshToken, 'refresh');
    assert.ok(session.expiresAt > Math.floor(Date.now() / 1000));
  });

  it('retains the refresh token when fnOS does not rotate it', async () => {
    const adapter = new FnosOAuthAdapter({
      endpoint, deviceId, allowInsecureHttp: true,
      fetch: async (input, init) => {
        assert.equal(String(input), `${endpoint}/oauthapi/refresh`);
        assert.deepEqual(Object.keys(JSON.parse(String(init?.body))).sort(), ['client_id', 'device_id', 'refresh_token']);
        return jsonResponse({ code: 0, data: { access_token: 'new-access', expires_in: 3600 } });
      },
    });
    const refreshed = await adapter.refresh({ accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: 0 });
    assert.equal(refreshed.accessToken, 'new-access');
    assert.equal(refreshed.refreshToken, 'old-refresh');
  });
});

describe('FnosOAuthClient', () => {
  it('calls the protected API and works with existing User module', async () => {
    let request: Record<string, unknown> | undefined;
    const adapter = new FnosOAuthAdapter({ endpoint, deviceId, allowInsecureHttp: true });
    const client = new FnosOAuthClient(adapter, { accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600 }, {
      fetch: async (input, init) => {
        assert.equal(String(input), `${endpoint}/ogh/ac/w`);
        assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer access');
        request = JSON.parse(String(init?.body));
        return jsonResponse([{ result: 'succ', reqid: request?.reqid, userInfo: { user: 'test' } }]);
      },
    });
    const response = await new User(client).getInfo();
    assert.equal(response.userInfo.user, 'test');
    assert.equal(request?.req, 'user.info');
    assert.equal(typeof request?.reqid, 'string');
  });

  it('stops after one refresh when the gateway returns 401 again', async () => {
    let apiCalls = 0;
    let refreshCalls = 0;
    const adapter = new FnosOAuthAdapter({
      endpoint, deviceId, allowInsecureHttp: true,
      fetch: async () => {
        refreshCalls++;
        return jsonResponse({ code: 0, data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 } });
      },
    });
    const client = new FnosOAuthClient(adapter, { accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600 }, {
      fetch: async () => { apiCalls++; return jsonResponse({ code: 401 }, 401); },
    });
    await assert.rejects(client.requestPayloadWithResponse('user.info', {}), /HTTP 401/);
    assert.equal(apiCalls, 2);
    assert.equal(refreshCalls, 1);
  });

  it('refreshes once after a 401 and retries the API call', async () => {
    let apiCalls = 0;
    let refreshCalls = 0;
    const adapter = new FnosOAuthAdapter({
      endpoint, deviceId, allowInsecureHttp: true,
      fetch: async () => {
        refreshCalls++;
        return jsonResponse({ code: 0, data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 } });
      },
    });
    const client = new FnosOAuthClient(adapter, { accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600 }, {
      fetch: async (_input, init) => {
        apiCalls++;
        const token = new Headers(init?.headers).get('authorization');
        return token === 'Bearer old-access' ? jsonResponse({ code: 401 }, 401) : jsonResponse({ result: 'succ' });
      },
    });
    assert.equal((await client.requestPayloadWithResponse('user.info', {})).result, 'succ');
    assert.equal(apiCalls, 2);
    assert.equal(refreshCalls, 1);
    assert.equal(client.session.accessToken, 'new-access');
  });
});
