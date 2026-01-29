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

import { FnosClient } from '../src/index.js';

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
    console.error(`用法: tsx examples/login_via_token.ts --user=<用户名> --password=<密码> [-e=<服务器地址>]`);
    console.error(`错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  // 创建客户端实例
  let client = new FnosClient();

  // 设置消息回调
  client.onMessage(onMessageHandler);

  try {
    // 第一步：连接到服务器
    console.log('第一步：连接到服务器...');
    await client.connect(endpoint);
    console.log('✓ 连接已建立');

    // 第二步：使用用户名密码登录
    console.log('\n第二步：使用用户名密码登录...');
    const loginResult = await client.login(user, password);

    if (loginResult.result !== 'succ') {
      console.error(`✗ 登录失败: ${loginResult.msg || '未知错误'}`);
      return;
    }

    console.log('✓ 用户名密码登录成功');

    // 获取登录后的token、long_token和secret
    const token = loginResult.token;
    const longToken = loginResult.longToken;
    const secret = client.getDecryptedSecret();

    console.log(`  - token: ${token?.substring(0, 20)}...`);
    console.log(`  - long_token: ${longToken?.substring(0, 20)}...`);
    console.log(`  - secret: ${secret?.substring(0, 20)}...`);

    if (!token || !longToken || !secret) {
      console.error('✗ 未能获取完整的登录信息，无法进行token登录验证');
      return;
    }

    // 第三步：关闭连接
    console.log('\n第三步：关闭连接...');
    client.close();
    console.log('✓ 连接已关闭');

    // 第四步：重新连接
    console.log('\n第四步：重新连接...');
    client = new FnosClient(); // 创建新的客户端实例
    client.onMessage(onMessageHandler);
    await client.connect(endpoint);
    console.log('✓ 连接已建立');

    // 第五步：使用token重新登录
    console.log('\n第五步：使用token重新登录...');
    const tokenLoginResult = await client.loginViaToken(token, longToken, secret);

    if (tokenLoginResult.result === 'succ' || tokenLoginResult.errno === 0) {
      console.log('✓ Token登录成功');
      console.log(`  - 响应: ${JSON.stringify(tokenLoginResult)}`);
    } else {
      console.error(`✗ Token登录失败: ${tokenLoginResult.msg || tokenLoginResult.errmsg || '未知错误'}`);
      console.log(`  - 响应: ${JSON.stringify(tokenLoginResult)}`);
    }
  } catch (e) {
    console.error(`✗ 发生错误: ${e}`);
  } finally {
    // 关闭连接
    if (client.isConnected()) {
      client.close();
      console.log('\n✓ 连接已关闭');
    }
  }
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});