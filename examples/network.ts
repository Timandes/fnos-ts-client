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

import { FnosClient, Network } from '../src/index.js';

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
    console.error(`用法: tsx examples/network.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  // 创建客户端实例
  const client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  try {
    // 连接到服务器
    console.log('正在连接到服务器...');
    await client.connect(endpoint);
    console.log('连接已建立');

    // 登录
    console.log('正在登录...');
    const loginResult = await client.login(user, password);

    if (loginResult.result === 'succ') {
      console.log('登录成功');
    } else {
      console.error(`登录失败: ${loginResult.msg || '未知错误'}`);
      return;
    }

    // 创建Network实例
    const network = new Network(client);

    // 调用list方法 (type=0)
    console.log('\n正在调用list方法 (type=0)...');
    try {
      const result = await network.list(0);
      console.log('list响应:');
      console.log(result);
    } catch (e) {
      console.error(`list调用失败: ${e}`);
    }

    // 调用list方法 (type=1)
    console.log('\n正在调用list方法 (type=1)...');
    try {
      const result = await network.list(1);
      console.log('list响应:');
      console.log(result);
    } catch (e) {
      console.error(`list调用失败: ${e}`);
    }

    // 调用detect方法 (需要先获取网络接口名称)
    console.log('\n正在调用detect方法...');
    try {
      // 尝试检测常见的网络接口
      const interfaces = ['eth0', 'ens33', 'enp0s3', 'wlan0'];
      for (const iface of interfaces) {
        try {
          const result = await network.detect(iface);
          console.log(`detect(${iface})响应:`);
          console.log(result);
          break;
        } catch (e) {
          // 继续尝试下一个接口
        }
      }
    } catch (e) {
      console.error(`detect调用失败: ${e}`);
    }
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