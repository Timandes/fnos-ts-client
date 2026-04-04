// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { FnosClient } from '../../client.js';

/**
 * 连接到 mock server 并登录
 */
export async function createConnectedClient(): Promise<{ client: FnosClient }> {
  const client = new FnosClient();
  await client.connect('127.0.0.1:5666', 3000);
  if (!client.isConnected()) {
    throw new Error('连接失败');
  }
  const loginResult = await client.login('admin', 'admin', 10000);
  if (loginResult.result !== 'succ') {
    await client.close();
    throw new Error(`登录失败: ${JSON.stringify(loginResult)}`);
  }
  return { client };
}

/**
 * 关闭客户端连接
 */
export async function cleanupClient(client: FnosClient): Promise<void> {
  try {
    await client.close();
  } catch {
    // Ignore
  }
}
