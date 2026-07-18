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
