import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FnosClient } from '../../src/index.js';
import { connectClient, loginWithTwofa, type ToolArgs } from '../../src/tools/common.js';

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
