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
 * 简单的连接测试，不执行任何业务操作
 */

function parseArgs(args: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        const name = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result[name] = value;
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
        const name = arg.slice(1, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result[name] = value;
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
  const duration = parseInt(parsed['d'] || '30', 10);

  if (!user || !password) {
    console.error(`用法: tsx examples/simple_test.ts --user <用户名> --password <密码> [-e <服务器地址>] [-d <时长>]`);
    process.exit(1);
  }

  console.log(`连接到服务器 ${endpoint}...`);

  const client = new FnosClient();

  // 监听消息
  client.onMessage((message: string) => {
    console.log(`收到消息: ${message.substring(0, 100)}...`);
  });

  try {
    await client.connect(endpoint);
    console.log('✓ 连接成功');

    await client.login(user, password);
    console.log('✓ 登录成功');

    // 创建User实例
    const userModule = new User(client);

    // 持续发送业务请求
    console.log(`持续发送业务请求 ${duration} 秒...`);

    for (let i = 1; i <= duration; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!client.isConnected()) {
        console.error(`第 ${i} 秒：连接已断开！`);
        break;
      }

      // 每2秒发送一次业务请求
      if (i % 2 === 0) {
        try {
          await userModule.getInfo();
          console.log(`第 ${i} 秒：发送业务请求成功`);
        } catch (e) {
          console.error(`第 ${i} 秒：业务请求失败: ${e}`);
        }
      } else {
        console.log(`第 ${i} 秒：连接正常`);
      }
    }

    console.log(`测试结束`);

  } catch (e) {
    console.error(`发生错误: ${e}`);
  } finally {
    client.close();
    console.log('连接已关闭');
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});