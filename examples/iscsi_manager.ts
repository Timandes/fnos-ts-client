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
 * IscsiManager 示例代码
 *
 * 演示如何使用 IscsiManager 类来管理 iSCSI 配置。
 *
 * 运行方式: tsx examples/iscsi_manager.ts --user <用户名> --password <密码> [-e <服务器地址>]
 */

import { FnosClient, IscsiManager } from '../src/index.js';

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
  const parsed = parseArgs(args);

  const user = parsed['user'];
  const password = parsed['password'];
  const endpoint = parsed['e'] || parsed['endpoint'] || 'your-custom-endpoint.com:5666';

  if (!user || !password) {
    console.error(`用法: tsx examples/iscsi_manager.ts --user <用户名> --password <密码> [-e <服务器地址>]`);
    console.error(`  或: tsx examples/iscsi_manager.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  const client = new FnosClient();

  try {
    await client.connect(endpoint);
    console.log('连接成功');

    const loginResult = await client.login(user, password);
    if (loginResult.result !== 'succ') {
      console.log(`登录失败: ${JSON.stringify(loginResult)}`);
      return;
    }
    console.log('登录成功');

    const iscsi = new IscsiManager(client);

    // 1. 获取 iSCSI 配置
    console.log('\n=== iSCSI 配置 ===');
    const config = await iscsi.getConfig();
    if (config.result === 'succ' && config.data) {
      const d = config.data;
      console.log(`端口: ${d.port}`);
      console.log(`队列深度: ${d.queueDepth}`);
      console.log(`CHAP 认证: ${d.chap ? '启用' : '禁用'}`);
      console.log(`双向 CHAP: ${d.mutualChap ? '启用' : '禁用'}`);
    }

    // 2. 获取 iSCSI Initiator 列表
    console.log('\n=== iSCSI Initiator 列表 ===');
    const initiators = await iscsi.listInitiators();
    if (initiators.result === 'succ' && initiators.data) {
      console.log(`总数: ${initiators.data.totalCount}`);
    }

    // 3. 获取 iSCSI LUN 列表
    console.log('\n=== iSCSI LUN 列表 ===');
    const luns = await iscsi.listLuns();
    if (luns.result === 'succ' && luns.data?.luns) {
      for (const lun of luns.data.luns) {
        console.log(`LUN 名称: ${lun.lunNickname}`);
        console.log(`  WWN: ${lun.wwn}`);
        console.log(`  大小: ${lun.lunSize} ${lun.lunSizeUnit}`);
        console.log(`  存储: ${lun.storageName}`);
        console.log(`  状态: ${lun.state}`);
        console.log(`  关联 Target 数: ${lun.targets?.length || 0}`);
        console.log();
      }
    }

    // 4. 获取 iSCSI Target 列表
    console.log('\n=== iSCSI Target 列表 ===');
    const targets = await iscsi.listTargets();
    if (targets.result === 'succ' && targets.data?.targets) {
      for (const target of targets.data.targets) {
        console.log(`Target 名称: ${target.targetName}`);
        console.log(`  IQN: ${target.iqn}`);
        console.log(`  状态: ${target.enabled ? '启用' : '禁用'}`);
        console.log(`  CHAP: ${target.chap ? '启用' : '禁用'}`);
        console.log(`  关联 LUN 数: ${target.luns?.length || 0}`);
        console.log(`  门户数: ${target.portals?.length || 0}`);
        console.log();
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
