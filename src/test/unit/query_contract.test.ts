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
