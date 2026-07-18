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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const exec = promisify(execFile);
const examples = [
  'backup_manager.ts',
  'download_center.ts',
  'ip_blocker.ts',
  'license_manager.ts',
  'live_update.ts',
  'mount_manager.ts',
  'network_server.ts',
  'security.ts',
  'system_restore.ts',
  'twofa_login.ts',
  'https_required_error.ts',
  'docker_manager.ts',
  'network.ts',
  'resource_monitor.ts',
  'file.ts',
  'store.ts',
  'user.ts',
  'share.ts',
  'sac.ts',
  'system_info.ts',
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
