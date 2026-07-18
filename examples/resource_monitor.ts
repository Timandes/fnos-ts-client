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
    printAuthHelp('资源监控只读查询');
    return;
  }
  const authArgs = parseAuthArgs(args);

  const client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  // 连接到服务器（必须指定endpoint）
  await client.connect(
    authArgs.endpoint, 3000, authArgs.useSsl, authArgs.skipSslVerify,
  );

  if (client.isConnected()) {
    console.log('连接成功，尝试登录...');
    try {
      const result = await loginWithTwofa(client, authArgs);
      console.log('登录结果:', result);

      // 创建ResourceMonitor实例
      const resourceMonitor = new ResourceMonitor(client);

      console.log('NPU 资源信息:', await resourceMonitor.npu());
      console.log('进程资源信息:', await resourceMonitor.processes());
      console.log('服务进程资源信息:', await resourceMonitor.serviceProcesses());
      console.log('系统风扇信息:', await resourceMonitor.systemFan());

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
