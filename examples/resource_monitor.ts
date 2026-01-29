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

import { FnosClient, ResourceMonitor } from '../src/index.js';

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
    console.error(`用法: tsx examples/resource_monitor.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
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

      // 创建ResourceMonitor实例
      const resourceMonitor = new ResourceMonitor(client);

      // 调用cpu方法
      try {
        const cpuResult = await resourceMonitor.cpu();
        console.log('CPU资源信息:', cpuResult);
      } catch (e) {
        console.error(`获取CPU资源信息失败: ${e}`);
      }

      // 调用gpu方法
      try {
        const gpuResult = await resourceMonitor.gpu();
        console.log('GPU资源信息:', gpuResult);
      } catch (e) {
        console.error(`获取GPU资源信息失败: ${e}`);
      }

      // 调用memory方法
      try {
        const memoryResult = await resourceMonitor.memory();
        console.log('内存资源信息:', memoryResult);
      } catch (e) {
        console.error(`获取内存资源信息失败: ${e}`);
      }

      // 调用disk方法
      try {
        const diskResult = await resourceMonitor.disk();
        console.log('磁盘资源信息:', diskResult);
      } catch (e) {
        console.error(`获取磁盘资源信息失败: ${e}`);
      }

      // 调用net方法
      try {
        const netResult = await resourceMonitor.net();
        console.log('网络资源信息:', netResult);
      } catch (e) {
        console.error(`获取网络资源信息失败: ${e}`);
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