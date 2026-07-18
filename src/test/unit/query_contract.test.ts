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

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { DockerManager } from '../../docker_manager.js';
import { BackupManager } from '../../backup_manager.js';
import { FnosClient } from '../../client.js';
import { LicenseManager } from '../../license_manager.js';
import { Network } from '../../network.js';
import { NetworkServer } from '../../network_server.js';
import { Security } from '../../security.js';
import { Share } from '../../share.js';
import { User } from '../../user.js';
import {
  ALL_QUERY_CASES,
  EXISTING_QUERY_CASES,
  NEW_QUERY_CASES,
} from './query_cases.js';
import { assertQueryCase } from './query_contract.js';

describe('query contract harness', () => {
  it('checks endpoint, payload, timeout, and identity response', () =>
    assertQueryCase({
      name: 'harness-smoke',
      endpoint: 'example.query',
      payload: { value: 1 },
      invoke: (client, timeout) =>
        client.requestPayloadWithResponse(
          'example.query',
          { value: 1 },
          timeout,
        ),
    }));
});

describe('new extended query contracts', () => {
  it('contains 82 cases for 71 unique endpoints', () => {
    assert.equal(ALL_QUERY_CASES.length, 82);
    assert.equal(
      new Set(ALL_QUERY_CASES.map((query) => query.endpoint)).size,
      71,
    );
  });

  for (const query of NEW_QUERY_CASES) {
    it(query.name, () => assertQueryCase(query));
  }

  it('validates new-domain arguments and copies processes', async () => {
    const client = new FnosClient();
    const request = mock.method(
      client,
      'requestPayloadWithResponse',
      async () => ({}),
    );
    try {
      await assert.rejects(new BackupManager(client).listTasks(2));
      await assert.rejects(new LicenseManager(client).list(0));
      await assert.rejects(new NetworkServer(client).listDdnsRecords(1, 0));
      assert.equal(request.mock.callCount(), 0);

      const source = [{ pid: 1001, process: 'example' }];
      await new Security(client).getProcessTraffic(source);
      const sent = request.mock.calls[0].arguments[1] as {
        data: typeof source;
      };
      assert.deepEqual(sent.data, source);
      assert.notEqual(sent.data, source);
      assert.notEqual(sent.data[0], source[0]);
    } finally {
      request.mock.restore();
    }
  });
});

describe('existing extended query contracts', () => {
  it('contains 54 captured request cases', () => {
    assert.equal(EXISTING_QUERY_CASES.length, 54);
  });

  for (const query of EXISTING_QUERY_CASES) {
    it(query.name, () => assertQueryCase(query));
  }

  it('rejects invalid existing-domain arguments before sending', async () => {
    const client = new FnosClient();
    const request = mock.method(
      client,
      'requestPayloadWithResponse',
      async () => ({ result: 'unexpected' }),
    );
    try {
      await assert.rejects(new Network(client).getInfo(''));
      await assert.rejects(new User(client).getUserTwofaConfig(-1));
      await assert.rejects(new User(client).getGroupInfo('   '));
      await assert.rejects(new User(client).getPreference(''));
      await assert.rejects(
        new DockerManager(client).listRegistryRepositories('', 0),
      );
      await assert.rejects(new Share(client).listLinks(false, '', 1, 0));
      assert.equal(request.mock.callCount(), 0);
    } finally {
      request.mock.restore();
    }
  });
});
