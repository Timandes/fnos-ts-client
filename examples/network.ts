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
    printAuthHelp('网络只读查询');
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

    // 创建Network实例
    const network = new Network(client);

    console.log('网关:', await network.getGateway());
    console.log('多网关状态:', await network.getMultiGatewayStatus());
    console.log('网卡性能模式:', await network.getNicPerformanceMode());
    console.log('eth0 信息:', await network.getInfo('eth0'));
    console.log('SSH 状态:', await network.getSshStatus());

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
