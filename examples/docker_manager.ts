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
 * DockerManager 示例代码
 *
 * 演示如何使用 DockerManager 类来管理 Docker 容器和项目。
 *
 * 运行方式: tsx examples/docker_manager.ts --user <用户名> --password <密码> [-e <服务器地址>]
 */

import { FnosClient, DockerManager } from '../src/index.js';
import { loginWithTwofa, parseAuthArgs, printAuthHelp } from './common.js';

function parseArgs(args: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        result[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
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
        result[arg.slice(1, eqIndex)] = arg.slice(eqIndex + 1);
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
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printAuthHelp('Docker 只读查询');
    return;
  }
  const authArgs = parseAuthArgs(args);

  const client = new FnosClient();

  try {
    await client.connect(
      authArgs.endpoint, 3000, authArgs.useSsl, authArgs.skipSslVerify,
    );
    console.log('连接成功');

    await loginWithTwofa(client, authArgs);
    console.log('登录成功');

    const docker = new DockerManager(client);

    console.log('镜像下载:', await docker.listImageDownloads());
    console.log('镜像:', await docker.listImages());
    console.log('网络:', await docker.listNetworks());
    console.log('注册表仓库:', await docker.listRegistryRepositories());

    // 1. 获取 Docker Compose 项目列表
    console.log('\n=== Docker Compose 项目列表 ===');
    const composeList = await docker.listComposes();
    if (composeList.result === 'succ') {
      for (const project of composeList.rsp) {
        console.log(`项目名称: ${project.Name}`);
        console.log(`  状态: ${project.Status}`);
        console.log(`  容器数: ${project.Containers.running}/${project.Containers.total}`);
        console.log(`  配置文件: ${project.ConfigFiles}`);
        console.log();
      }
    }

    // 2. 获取容器列表
    console.log('=== 容器列表 ===');
    const containerList = await docker.listContainers(true);
    if (containerList.result === 'succ') {
      for (const container of containerList.rsp) {
        console.log(`容器名称: ${container.Names[0]}`);
        console.log(`  状态: ${container.State}`);
        console.log(`  镜像: ${container.Image}`);
        console.log(`  项目: ${container.Project}`);
        console.log();
      }
    }

    // 3. 获取容器统计信息
    console.log('=== 容器统计信息 ===');
    const stats = await docker.stats();
    if (stats.result === 'succ') {
      for (const [containerId, stat] of Object.entries(stats.rsp)) {
        const s = stat as any;
        console.log(`容器 ID: ${containerId.slice(0, 12)}...`);
        console.log(`  CPU 使用率: ${(s.cpuUsage * 100).toFixed(2)}%`);
        console.log(`  内存使用: ${(s.usedMem / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  网络接收: ${s.networkRx} bytes`);
        console.log(`  网络发送: ${s.networkTx} bytes`);
        console.log();
      }
    }

    // 4. 获取 Docker 系统设置
    console.log('=== Docker 系统设置 ===');
    const systemSetting = await docker.getSystemSettings();
    if (systemSetting.result === 'succ') {
      const settings = systemSetting.rsp;
      console.log(`数据根目录: ${settings.dataRoot}`);
      console.log(`当前镜像源: ${settings.currentMirror}`);
      console.log(`自动启动: ${settings.autoBoot}`);
      console.log(`Docker 状态: ${settings.status ? '运行中' : '已停止'}`);
      console.log('可用镜像源:');
      for (const mirror of settings.mirrorsV2) {
        console.log(`  ${mirror.res ? '✓' : '✗'} ${mirror.name}: ${mirror.url}`);
      }
    }
  } finally {
    client.close();
    console.log('\n连接已关闭');
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});
