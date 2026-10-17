import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FnosOAuthAdapter } from '../../oauth_adapter.js';
import { FnosOAuthClient } from '../../oauth_client.js';
import { ALL_QUERY_CASES } from './query_cases.js';

describe('existing business queries over OAuth HTTP', () => {
  for (const query of ALL_QUERY_CASES) {
    it(query.name, async () => {
      let calls = 0;
      const adapter = new FnosOAuthAdapter({ endpoint: 'https://nas.example:5667' });
      const expectedResponse = { result: 'succ', data: { query: query.name } };
      const client = new FnosOAuthClient(adapter, {
        accessToken: 'test-access', refreshToken: 'test-refresh',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }, {
        fetch: async (input, init) => {
          calls++;
          assert.equal(String(input), 'https://nas.example:5667/ogh/ac/w');
          assert.equal(init?.method, 'POST');
          assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-access');
          const { req, reqid, ...payload } = JSON.parse(String(init?.body));
          assert.equal(req, query.endpoint);
          assert.match(reqid, /^\d{13}[a-f0-9]{12}$/);
          assert.deepEqual(payload, query.payload);
          return new Response(JSON.stringify([expectedResponse]), {
            headers: { 'content-type': 'application/json' },
          });
        },
      });
      assert.deepEqual(await query.invoke(client, 2500), expectedResponse);
      assert.equal(calls, 1);
    });
  }
});
