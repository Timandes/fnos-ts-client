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
 * SSL/WSS 连接示例代码
 *
 * 演示如何使用 SSL/WSS 协议连接到 fnOS 服务器。
 *
 * 运行方式:
 *   tsx examples/ssl_connect.ts --user <用户名> --password <密码> [-e <服务器地址>] [--use-ssl] [--verify-ssl]
 *
 * 参数说明:
 *   --user           用户名（必填）
 *   --password       密码（必填）
 *   -e, --endpoint   服务器地址（默认 your-custom-endpoint.com:5666）
 *   --use-ssl        使用 WSS 协议连接（默认使用 WS）
 *   --verify-ssl     启用 SSL 证书验证（默认跳过验证，适用于自签名证书）
 */

import { FnosClient } from '../src/index.js';

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
  const useSsl = 'use-ssl' in parsed;
  const verifySsl = 'verify-ssl' in parsed;

  if (!user || !password) {
    console.error(`用法: tsx examples/ssl_connect.ts --user <用户名> --password <密码> [-e <服务器地址>] [--use-ssl] [--verify-ssl]`);
    console.error(`  或: tsx examples/ssl_connect.ts --user=<用户名> --password=<密码> [-e=<服务器地址>] [--use-ssl] [--verify-ssl]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  const client = new FnosClient();

  try {
    // 方式一: 使用 wss:// 协议前缀（优先级最高）
    if (useSsl) {
      console.log('使用 WSS 协议连接...');
      await client.connect(endpoint, 3000, useSsl, !verifySsl);
    } else {
      // 方式二: 使用普通 WS 协议
      console.log('使用 WS 协议连接...');
      await client.connect(endpoint, 3000);
    }

    if (!client.isConnected()) {
      console.log('连接失败');
      return;
    }
    console.log('连接成功');

    const loginResult = await client.login(user, password);
    if (loginResult.result !== 'succ') {
      console.log(`登录失败: ${JSON.stringify(loginResult)}`);
      return;
    }
    console.log('登录成功');

    // 获取解密后的 secret
    const decryptedSecret = client.getDecryptedSecret();
    if (decryptedSecret) {
      console.log(`保存的 secret: ${decryptedSecret.substring(0, 20)}...`);
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
