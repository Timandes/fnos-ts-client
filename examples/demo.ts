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

import { FnosClient } from '../src/index.js';

function onMessageHandler(message: string): void {
  console.log(`收到消息: ${message}`);
}

/**
 * 解析命令行参数，支持 Linux 标准格式
 * - 单字符参数：-e abc 或 -e=abc
 * - 多字符参数：--user 123 或 --user=123
 */
function parseArgs(args: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      // 长选项：--name value 或 --name=value
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        // --name=value 格式
        const name = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result[name] = value;
      } else {
        // --name value 格式
        const name = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result[name] = args[i + 1];
          i++;
        } else {
          result[name] = null;
        }
      }
    } else if (arg.startsWith('-')) {
      // 短选项：-e value 或 -e=value
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        // -e=value 格式
        const name = arg.slice(1, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result[name] = value;
      } else {
        // -e value 格式
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
  // 从命令行参数获取
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  const user = parsed['user'];
  const password = parsed['password'];
  const endpoint = parsed['e'] || parsed['endpoint'] || 'your-custom-endpoint.com:5666';

  if (!user || !password) {
    console.error(`用法: tsx examples/demo.ts --user <用户名> --password <密码> [-e <服务器地址>]`);
    console.error(`  或: tsx examples/demo.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  const client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  // 连接到服务器（必须指定endpoint）
  await client.connect(endpoint);

  if (client.isConnected()) {
    console.log('连接成功，尝试登录...');
    try {
      // 使用命令行参数中的用户名和密码
      const result = await client.login(user, password);
      console.log('登录结果:', result);

      // 获取解密后的secret
      const decryptedSecret = client.getDecryptedSecret();
      if (decryptedSecret) {
        console.log(`保存的secret: ${decryptedSecret.substring(0, 20)}...`);

        // 测试request方法
        try {
          await client.requestPayload('user.info', {});
          console.log('已发送请求，等待响应...');
          // 等待一段时间以接收响应
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (e) {
          console.error(`Request失败: ${e}`);
        }
      } else {
        console.log('未找到secret');
      }
    } catch (e) {
      console.error(`登录失败: ${e}`);
    }
  } else {
    console.log('连接失败');
  }

  // 关闭连接
  client.close();
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});