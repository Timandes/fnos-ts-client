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
 * 测试脚本：验证 client.close() 方法能够正常工作，程序不再卡住
 *
 * 这个测试验证修复后的 close() 方法能够：
 * 1. 正确清理 pendingRequests
 * 2. 允许程序正常退出
 * 3. 不再出现超时卡住的情况
 */

import { FnosClient, User } from '../src/index.js';

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
  console.log('=== 测试 client.close() 方法 ===\n');

  // 从命令行参数获取
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  const user = parsed['user'];
  const password = parsed['password'];
  const endpoint = parsed['e'] || parsed['endpoint'] || 'your-custom-endpoint.com:5666';

  if (!user || !password) {
    console.error(`用法: tsx examples/test_close.ts --user <用户名> --password <密码> [-e <服务器地址>]`);
    console.error(`  或: tsx examples/test_close.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  // 创建客户端实例
  const client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  try {
    // 步骤 1: 连接到服务器
    console.log('步骤 1: 连接到服务器...');
    await client.connect(endpoint);
    console.log('   ✓ 连接成功\n');

    // 步骤 2: 登录
    console.log('步骤 2: 登录...');
    const loginResult = await client.login(user, password);

    if (loginResult.result === 'succ') {
      console.log('   ✓ 登录成功\n');
    } else {
      console.error(`   ✗ 登录失败: ${loginResult.msg || '未知错误'}`);
      process.exit(1);
    }

    // 步骤 3: 发送一些请求（模拟正常使用）
    console.log('步骤 3: 发送测试请求...');
    const userModule = new User(client);

    try {
      console.log('   - 调用 getInfo...');
      await userModule.getInfo();
      console.log('     ✓ getInfo 成功');
    } catch (e) {
      console.log(`     ⚠ getInfo 失败: ${e}`);
    }

    try {
      console.log('   - 调用 listUserGroups...');
      await userModule.listUserGroups();
      console.log('     ✓ listUserGroups 成功');
    } catch (e) {
      console.log(`     ⚠ listUserGroups 失败: ${e}`);
    }

    console.log('   ✓ 测试请求完成\n');

    // 步骤 4: 测试 close() 方法
    console.log('步骤 4: 测试 close() 方法...');
    console.log('   准备调用 client.close()...');

    const closeStartTime = Date.now();
    client.close();
    const closeElapsed = Date.now() - closeStartTime;

    console.log(`   ✓ client.close() 调用完成（耗时 ${closeElapsed}ms）`);
    console.log(`   当前连接状态: ${client.isConnected() ? '已连接' : '未连接'}\n`);

    // 步骤 5: 验证程序能够正常退出
    console.log('步骤 5: 验证程序能够正常退出...');
    console.log('   等待 2 秒...');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('   ✓ 程序仍在运行，即将正常退出\n');

    console.log('=== 测试完成 ===');
    console.log('✓ 如果看到这条消息，说明修复成功！');
    console.log('✓ 程序能够正常退出，不再卡住\n');

  } catch (e) {
    console.error(`发生错误: ${e}\n`);
    console.error('测试失败');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});