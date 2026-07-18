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
      res.writeHead(302, {
        Location: 'https://nas.example.com:5667/websocket?type=main',
      });
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
          assert.equal(
            error.redirectUri,
            'https://nas.example.com:5667/websocket?type=main',
          );
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
          (error: unknown) =>
            error instanceof Error && !(error instanceof HTTPSRequiredError),
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
      headers: {
        location: 'https://nas.example.com/websocket?type=main',
      },
    };
    assert.equal(
      client.httpsRequiredError(
        'wss://nas.example.com/websocket?type=main',
        true,
        response,
      ),
      null,
    );
  });
});
