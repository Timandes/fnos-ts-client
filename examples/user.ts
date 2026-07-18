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
import { loginWithTwofa, parseAuthArgs, printAuthHelp } from './common.js';

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
  if (args.includes('--help')) {
    printAuthHelp('用户与权限只读查询');
    return;
  }
  const authArgs = parseAuthArgs(args);

  // 创建客户端实例
  const client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  try {
    // 连接到服务器
    console.log('正在连接到服务器...');
    await client.connect(
      authArgs.endpoint, 3000, authArgs.useSsl, authArgs.skipSslVerify,
    );
    console.log('连接已建立');

    // 登录
    console.log('正在登录...');
    await loginWithTwofa(client, authArgs);
    console.log('登录成功');

    // 创建User实例
    const userModule = new User(client);

    console.log('令牌:', await userModule.listTokens());
    console.log('我的两步验证配置:', await userModule.getMyTwofaConfig());
    console.log('全局两步验证配置:', await userModule.getGlobalTwofaConfig());
    console.log('用户两步验证配置:', await userModule.getUserTwofaConfig(0));
    console.log('活动状态:', await userModule.getActiveState());
    console.log('用户组信息:', await userModule.getGroupInfo('users'));
    console.log('用户组:', await userModule.listGroups());
    console.log('登录设备:', await userModule.listLoginDevices());
    console.log('日期格式偏好:', await userModule.getPreference('date-format'));

    // 调用getInfo方法
    console.log('\n正在调用getInfo方法...');
    try {
      const result = await userModule.getInfo();
      console.log('getInfo响应:');
      console.log(result);
    } catch (e) {
      console.error(`getInfo调用失败: ${e}`);
    }

    // 调用listUserGroups方法
    console.log('\n正在调用listUserGroups方法...');
    try {
      const result = await userModule.listUserGroups();
      console.log('listUserGroups响应:');
      console.log(result);
    } catch (e) {
      console.error(`listUserGroups调用失败: ${e}`);
    }

    // 调用groupUsers方法
    console.log('\n正在调用groupUsers方法...');
    try {
      const result = await userModule.groupUsers();
      console.log('groupUsers响应:');
      console.log(result);
    } catch (e) {
      console.error(`groupUsers调用失败: ${e}`);
    }

    // 调用isAdmin方法
    console.log('\n正在调用isAdmin方法...');
    try {
      const result = await userModule.isAdmin();
      console.log('isAdmin响应:');
      console.log(result);
    } catch (e) {
      console.error(`isAdmin调用失败: ${e}`);
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
