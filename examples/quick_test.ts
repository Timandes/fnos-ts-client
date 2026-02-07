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

import { FnosClient, User } from '../src/index.js';

/**
 * 快速测试 - 登录后立即执行操作
 */

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
    console.error(`用法: tsx examples/quick_test.ts --user <用户名> --password <密码> [-e <服务器地址>]`);
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('快速连接测试');
  console.log('='.repeat(80));

  const client = new FnosClient();

  // 设置消息回调
  client.onMessage((message: string) => {
    console.log(`[${new Date().toISOString()}] 📨 收到消息: ${message.substring(0, 100)}...`);
  });

  try {
    console.log(`\n[${new Date().toISOString()}] 步骤 1: 连接...`);
    await client.connect(endpoint);
    console.log(`[${new Date().toISOString()}] ✓ 连接成功`);

    console.log(`\n[${new Date().toISOString()}] 步骤 2: 登录...`);
    const loginResult = await client.login(user, password);
    console.log(`[${new Date().toISOString()}] ✓ 登录成功`);

    console.log(`\n[${new Date().toISOString()}] 步骤 3: 立即执行用户操作...`);
    const userModule = new User(client);
    const userInfo = await userModule.getInfo();
    console.log(`[${new Date().toISOString()}] ✓ 用户信息: ${userInfo.data?.name || 'N/A'}`);

    console.log(`\n[${new Date().toISOString()}] 步骤 4: 等待 10 秒，检查连接是否保持...`);
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isConnected = client.isConnected();
      console.log(`[${new Date().toISOString()}] 第 ${i} 秒: 连接状态 = ${isConnected ? '已连接' : '已断开'}`);

      if (!isConnected) {
        console.error(`[${new Date().toISOString()}] ⚠️  连接在第 ${i} 秒断开！`);
        break;
      }

      // 每 2 秒执行一次操作
      if (i % 2 === 0) {
        try {
          await userModule.getInfo();
          console.log(`[${new Date().toISOString()}] ✓ 用户操作成功`);
        } catch (e) {
          console.error(`[${new Date().toISOString()}] ✗ 用户操作失败: ${e}`);
          break;
        }
      }
    }

    console.log(`\n[${new Date().toISOString()}] ✓ 测试完成`);
  } catch (e) {
    console.error(`\n❌ 错误: ${e}`);
  } finally {
    console.log(`\n[${new Date().toISOString()}] 关闭连接...`);
    client.close();
    console.log(`[${new Date().toISOString()}] ✓ 连接已关闭`);
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});