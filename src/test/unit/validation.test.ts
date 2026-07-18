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
import {
  copyRecordList,
  requireNonEmptyString,
  requireNonNegativeInteger,
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

  it('rejects a non-record list', () => {
    for (const value of [null, {}, [null], [[]], ['process']]) {
      assert.throws(() => copyRecordList('processes', value));
    }
  });
});
