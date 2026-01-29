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

import { FnosClient, Store } from '../src/index.js';

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
    console.error(`用法: tsx examples/store.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
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

    // 创建Store实例
    const store = new Store(client);

    // 调用general方法
    console.log('\n正在调用general方法...');
    try {
      const result = await store.general();
      console.log('general响应:');
      console.log(result);
    } catch (e) {
      console.error(`general调用失败: ${e}`);
    }

    // 调用calculateSpace方法
    console.log('\n正在调用calculateSpace方法...');
    try {
      const result = await store.calculateSpace();
      console.log('calculateSpace响应:');
      console.log(result);
    } catch (e) {
      console.error(`calculateSpace调用失败: ${e}`);
    }

    // 调用listDisks方法
    console.log('\n正在调用listDisks方法...');
    try {
      const result = await store.listDisks(true);
      console.log('listDisks响应:');
      console.log(result);
    } catch (e) {
      console.error(`listDisks调用失败: ${e}`);
    }

    // 调用getDiskSmart方法 (需要先获取磁盘名称)
    console.log('\n正在调用getDiskSmart方法...');
    try {
      // 尝试获取磁盘列表
      const diskListResult = await store.listDisks(true);
      if (diskListResult.data && diskListResult.data.length > 0) {
        const diskName = diskListResult.data[0].name;
        const result = await store.getDiskSmart(diskName);
        console.log(`getDiskSmart(${diskName})响应:`);
        console.log(result);
      } else {
        console.log('未找到磁盘');
      }
    } catch (e) {
      console.error(`getDiskSmart调用失败: ${e}`);
    }

    // 调用getState方法
    console.log('\n正在调用getState方法...');
    try {
      // 需要实际的设备名称和UUID
      const result = await store.getState(['dm-1', 'dm-0'], ['trim_7cdec818_a061_415b_9307_400e4539235a-0', 'trim_13b15f05_d1cb_4fa3_8252_02809cab2410-0']);
      console.log('getState响应:');
      console.log(result);
    } catch (e) {
      console.error(`getState调用失败: ${e}`);
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