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
 * 演示如何手动处理重连
 *
 * 这个示例程序会：
 * 1. 连接到服务器并登录
 * 2. 监听连接状态
 * 3. 在检测到断连时手动调用 reconnect() 方法
 * 4. 展示如何实现自定义的重连策略
 */

/**
 * 解析命令行参数
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
  // 从命令行参数获取
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  const user = parsed['user'];
  const password = parsed['password'];
  const endpoint = parsed['e'] || parsed['endpoint'] || 'your-custom-endpoint.com:5666';

  if (!user || !password) {
    console.error(`用法: tsx examples/manual_reconnect.ts --user <用户名> --password <密码> [-e <服务器地址>]`);
    console.error(`  或: tsx examples/manual_reconnect.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`\n错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('手动重连功能演示');
  console.log('='.repeat(80));

  // 创建客户端实例
  const client = new FnosClient();

  // 设置消息回调
  client.onMessage((message: string) => {
    console.log(`收到消息: ${message.substring(0, 100)}...`);
  });

  console.log(`\n配置信息:`);
  console.log(`  - 服务器地址: ${endpoint}`);
  console.log(`  - 用户名: ${user}`);
  console.log('='.repeat(80));

  // 重连配置
  const maxReconnectAttempts = 5;
  const reconnectDelay = 5000;
  let reconnectAttempts = 0;

  // 重连函数
  const attemptReconnect = async (): Promise<boolean> => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error(`已达到最大重连尝试次数 (${maxReconnectAttempts})，停止重连`);
      return false;
    }

    reconnectAttempts++;
    console.log(`\n[${new Date().toISOString()}] 尝试重连（第${reconnectAttempts}/${maxReconnectAttempts}次）...`);

    // 延迟后重连
    await new Promise(resolve => setTimeout(resolve, reconnectDelay));

    try {
      await client.reconnect();
      console.log(`[${new Date().toISOString()}] ✓ 重连成功`);
      reconnectAttempts = 0;  // 重连成功，重置尝试次数
      return true;
    } catch (e) {
      console.error(`[${new Date().toISOString()}] ✗ 重连失败: ${e}`);
      return false;
    }
  };

  try {
    // 连接并登录
    console.log(`\n[${new Date().toISOString()}] 步骤 1: 连接到服务器...`);
    await client.connect(endpoint);
    console.log(`[${new Date().toISOString()}] ✓ 连接成功`);

    console.log(`\n[${new Date().toISOString()}] 步骤 2: 登录...`);
    const loginResult = await client.login(user, password);

    if (loginResult.result === 'succ') {
      console.log(`[${new Date().toISOString()}] ✓ 登录成功`);
    } else {
      console.error(`[${new Date().toISOString()}] ✗ 登录失败: ${loginResult.msg || '未知错误'}`);
      return;
    }

    // 创建User实例
    const userModule = new User(client);

    // 执行一些操作
    console.log(`\n[${new Date().toISOString()}] 步骤 3: 执行用户操作...`);
    const userInfo = await userModule.getInfo();
    console.log(`[${new Date().toISOString()}] ✓ 获取用户信息成功`);
    console.log(`  用户名: ${userInfo.data?.name || 'N/A'}`);

    // 模拟长时间连接
    console.log(`\n[${new Date().toISOString()}] 步骤 4: 模拟长时间连接（60秒）...`);
    console.log('提示: 如果连接断开，将尝试自动重连');
    console.log('-'.repeat(80));

    for (let i = 1; i <= 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));

      console.log(`\n[${new Date().toISOString()}] === 第 ${i} 次检查 (10秒) ===`);

      // 检查连接状态
      if (!client.isConnected()) {
        console.log(`[${new Date().toISOString()}] ⚠️  检测到连接断开`);

        // 尝试重连
        const reconnected = await attemptReconnect();
        if (!reconnected) {
          console.error(`[${new Date().toISOString()}] ❌ 重连失败，停止测试`);
          break;
        }
      }

      // 尝试执行用户操作
      try {
        const userInfo2 = await userModule.getInfo();
        console.log(`[${new Date().toISOString()}] ✓ 连接正常，用户名: ${userInfo2.data?.name || 'N/A'}`);
      } catch (e) {
        console.error(`[${new Date().toISOString()}] ✗ 用户操作失败: ${e}`);
        console.log(`[${new Date().toISOString()}] 尝试重连...`);

        const reconnected = await attemptReconnect();
        if (!reconnected) {
          console.error(`[${new Date().toISOString()}] ❌ 重连失败，停止测试`);
          break;
        }
      }
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`[${new Date().toISOString()}] 演示完成！`);

  } catch (e) {
    console.error(`\n❌ 发生错误: ${e}`);
  } finally {
    // 关闭连接
    console.log(`\n[${new Date().toISOString()}] 关闭连接...`);
    client.close();
    console.log(`[${new Date().toISOString()}] ✓ 连接已关闭`);
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});