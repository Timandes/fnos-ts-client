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

import { FnosClient, SystemInfo } from '../src/index.js';

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
    console.error('用法: tsx examples/system_info.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]');
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

    // 创建SystemInfo实例
    const systemInfo = new SystemInfo(client);

    // 调用getHostName方法
    console.log('\n正在调用getHostName方法...');
    try {
      const result = await systemInfo.getHostName();
      console.log('getHostName响应:');
      console.log(result);
    } catch (e) {
      console.error(`getHostName调用失败: ${e}`);
    }

    // 调用getTrimVersion方法
    console.log('\n正在调用getTrimVersion方法...');
    try {
      const result = await systemInfo.getTrimVersion();
      console.log('getTrimVersion响应:');
      console.log(result);
    } catch (e) {
      console.error(`getTrimVersion调用失败: ${e}`);
    }

    // 调用getMachineId方法
    console.log('\n正在调用getMachineId方法...');
    try {
      const result = await systemInfo.getMachineId();
      console.log('getMachineId响应:');
      console.log(result);
    } catch (e) {
      console.error(`getMachineId调用失败: ${e}`);
    }

    // 调用getHardwareInfo方法
    console.log('\n正在调用getHardwareInfo方法...');
    try {
      const result = await systemInfo.getHardwareInfo();
      console.log('getHardwareInfo响应:');
      console.log(result);
    } catch (e) {
      console.error(`getHardwareInfo调用失败: ${e}`);
    }

    // 调用getUptime方法
    console.log('\n正在调用getUptime方法...');
    try {
      const result = await systemInfo.getUptime();
      console.log('getUptime响应:');
      console.log(result);
    } catch (e) {
      console.error(`getUptime调用失败: ${e}`);
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