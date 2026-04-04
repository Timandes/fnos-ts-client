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

/**
 * Notify 示例代码
 *
 * 演示如何使用 Notify 类来获取通知信息。
 *
 * 运行方式: tsx examples/notify.ts --user <用户名> --password <密码> [-e <服务器地址>]
 */

import { FnosClient, Notify } from '../src/index.js';

function parseArgs(args: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        result[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      } else {
        const name = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result[name] = args[i + 1];
          i++;
        } else {
          result[name] = null;
        }
      }
    } else if (arg.startsWith('-')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        result[arg.slice(1, eqIndex)] = arg.slice(eqIndex + 1);
      } else {
        const name = arg.slice(1);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result[name] = args[i + 1];
          i++;
        } else {
          result[name] = null;
        }
      }
    }
    i++;
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  const user = parsed['user'];
  const password = parsed['password'];
  const endpoint = parsed['e'] || parsed['endpoint'] || 'your-custom-endpoint.com:5666';

  if (!user || !password) {
    console.error(`用法: tsx examples/notify.ts --user <用户名> --password <密码> [-e <服务器地址>]`);
    console.error(`  或: tsx examples/notify.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  const client = new FnosClient();

  try {
    await client.connect(endpoint);
    console.log('连接成功');

    const loginResult = await client.login(user, password);
    if (loginResult.result !== 'succ') {
      console.log(`登录失败: ${JSON.stringify(loginResult)}`);
      return;
    }
    console.log('登录成功');

    const notify = new Notify(client);

    // 获取未读通知总数
    console.log('\n=== 通知信息 ===');
    const unreadTotal = await notify.unreadTotal();
    if (unreadTotal.result === 'succ') {
      console.log(`未读通知数: ${unreadTotal.unreadTotal}`);
    }
  } finally {
    client.close();
    console.log('\n连接已关闭');
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});
