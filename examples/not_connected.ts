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

import { FnosClient, NotConnectedError } from '../src/index.js';

async function main() {
  // 从命令行参数获取
  const args = process.argv.slice(2);
  const user = args.find((arg) => arg.startsWith('--user='))?.split('=')[1];
  const password = args.find((arg) => arg.startsWith('--password='))?.split('=')[1];
  const endpoint = args.find((arg) => arg.startsWith('-e='))?.split('=')[1] || args.find((arg) => arg.startsWith('--endpoint='))?.split('=')[1] || 'your-custom-endpoint.com:5666';

  console.log('演示如何捕获和处理NotConnectedError异常\n');

  // 创建客户端实例（不连接）
  const client = new FnosClient();

  // 尝试在未连接的情况下调用需要连接的方法
  console.log('尝试在未连接的情况下调用login方法...');
  try {
    await client.login(user || 'test', password || 'test');
  } catch (error) {
    if (error instanceof NotConnectedError) {
      console.log(`✓ 成功捕获NotConnectedError: ${error.message}`);
    } else {
      console.log(`✗ 捕获到其他错误: ${error}`);
    }
  }

  // 尝试在未连接的情况下调用request方法
  console.log('\n尝试在未连接的情况下调用request方法...');
  try {
    await client.request('test');
  } catch (error) {
    if (error instanceof NotConnectedError) {
      console.log(`✓ 成功捕获NotConnectedError: ${error.message}`);
    } else {
      console.log(`✗ 捕获到其他错误: ${error}`);
    }
  }

  // 尝试在未连接的情况下调用requestPayload方法
  console.log('\n尝试在未连接的情况下调用requestPayload方法...');
  try {
    await client.requestPayload('test', {});
  } catch (error) {
    if (error instanceof NotConnectedError) {
      console.log(`✓ 成功捕获NotConnectedError: ${error.message}`);
    } else {
      console.log(`✗ 捕获到其他错误: ${error}`);
    }
  }

  // 尝试在未连接的情况下调用requestPayloadWithResponse方法
  console.log('\n尝试在未连接的情况下调用requestPayloadWithResponse方法...');
  try {
    await client.requestPayloadWithResponse('test', {});
  } catch (error) {
    if (error instanceof NotConnectedError) {
      console.log(`✓ 成功捕获NotConnectedError: ${error.message}`);
    } else {
      console.log(`✗ 捕获到其他错误: ${error}`);
    }
  }

  console.log('\n演示完成！NotConnectedError异常可以被正确捕获和处理。');
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});