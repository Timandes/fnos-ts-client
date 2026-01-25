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

import { FnosClient, User } from '../src/index.js';

function onMessageHandler(message: string): void {
  console.log(`收到消息: ${message}`);
}

async function main() {
  // 从命令行参数获取
  const args = process.argv.slice(2);
  const user = args.find((arg) => arg.startsWith('--user='))?.split('=')[1];
  const password = args.find((arg) => arg.startsWith('--password='))?.split('=')[1];
  const endpoint = args.find((arg) => arg.startsWith('-e='))?.split('=')[1] || args.find((arg) => arg.startsWith('--endpoint='))?.split('=')[1] || 'your-custom-endpoint.com:5666';

  if (!user || !password) {
    console.error('错误: 必须提供 --user 和 --password 参数');
    console.error('用法: tsx examples/reconnect.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]');
    process.exit(1);
  }

  console.log('演示如何使用FnosClient的自动重连功能\n');

  // 创建客户端实例
  const client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  try {
    // 第一次连接和登录
    console.log('第一次连接和登录...');
    await client.connect(endpoint);
    const loginResult = await client.login(user, password);

    if (loginResult.result === 'succ') {
      console.log('✓ 第一次登录成功');
    } else {
      console.error(`✗ 登录失败: ${loginResult.msg || '未知错误'}`);
      return;
    }

    // 创建User实例并获取用户信息
    const userModule = new User(client);
    const userInfo = await userModule.getInfo();
    console.log('✓ 获取用户信息成功');
    console.log(`  用户名: ${userInfo.data?.name || 'N/A'}`);

    // 手动关闭连接
    console.log('\n手动关闭连接...');
    client.close();
    console.log('✓ 连接已关闭');

    // 检查连接状态
    console.log(`\n当前连接状态: ${client.isConnected() ? '已连接' : '未连接'}`);

    // 使用reconnect方法重新连接
    console.log('\n使用reconnect方法重新连接...');
    await client.reconnect();
    console.log('✓ 重连成功');

    // 再次获取用户信息验证重连是否成功
    console.log('\n再次获取用户信息验证重连...');
    const userInfo2 = await userModule.getInfo();
    console.log('✓ 获取用户信息成功');
    console.log(`  用户名: ${userInfo2.data?.name || 'N/A'}`);

    console.log('\n重连功能演示完成！');
  } catch (e) {
    console.error(`发生错误: ${e}`);
  } finally {
    // 关闭连接
    client.close();
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});