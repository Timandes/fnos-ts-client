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
 * Share 示例代码
 *
 * 演示如何使用 Share 类来获取共享配置信息。
 *
 * 运行方式: tsx examples/share.ts --user <用户名> --password <密码> [-e <服务器地址>]
 */

import { FnosClient, Share } from '../src/index.js';
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
    printAuthHelp('共享服务只读查询');
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

    const share = new Share(client);

    console.log('DLNA 选项:', await share.dlnaOptions());
    console.log('DLNA 共享选项:', await share.dlnaShareOptions());
    console.log('FTP 选项:', await share.ftpOptions());
    console.log('FTP 共享选项:', await share.ftpShareOptions());
    console.log('NFS 选项:', await share.nfsOptions());
    console.log('NFS 共享选项:', await share.nfsShareOptions());
    console.log('SMB 共享选项:', await share.smbShareOptions());
    console.log('WebDAV 选项:', await share.webdavOptions());
    console.log('WebDAV 共享选项:', await share.webdavShareOptions());
    console.log('链接默认设置:', await share.getLinkDefaults());
    console.log('默认链接:', await share.getDefaultLink());
    console.log('链接列表:', await share.listLinks());
    console.log('链接权限:', await share.getLinkPermission());

    // 获取 SMB 配置信息
    console.log('\n=== SMB 配置信息 ===');
    const smbConfig = await share.smbOpt();
    if (smbConfig.result === 'succ') {
      const config = smbConfig.data;
      console.log(`SMB 服务: ${config.smbEnable ? '启用' : '禁用'}`);
      console.log(`WSDD 服务: ${config.wsddEnable ? '启用' : '禁用'}`);
      console.log(`IPv4 地址: ${config.ipv4Addr}`);
      console.log(`服务端口: ${config.svcPort}`);
      console.log(`挂载名称: ${config.mount}`);
      console.log(`工作模式: ${config.mode}`);

      console.log('\nSMB 选项:');
      const option = config.option;
      console.log(`  工作组: ${option.workGroup || '默认'}`);
      console.log(`  机会锁: ${option.oplocks ? '启用' : '禁用'}`);
      console.log(`  NTLMv1: ${option.ntlmv1 ? '启用' : '禁用'}`);
      console.log(`  服务器签名: ${option.serverSigning}`);
      console.log(`  传输加密: ${option.transportEncryption}`);
      console.log(`  支持 SMB1: ${option.supportSmb1 ? '启用' : '禁用'}`);
      console.log(`  多通道: ${option.enableMultiChannel ? '启用' : '禁用'}`);

      console.log('\nTime Machine:');
      const timeMachine = config.timeMachine;
      console.log(`  状态: ${timeMachine.enable ? '启用' : '禁用'}`);
      if (timeMachine.enable) {
        console.log(`  存储空间: ${timeMachine.vol}`);
        console.log(`  配额: ${(timeMachine.quota / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  文件夹: ${timeMachine.folder}`);
        console.log(`  当前状态: ${timeMachine.status}`);
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
