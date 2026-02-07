// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the "License');
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

import { FnosClient, User } from '../src/index.js';

/**
 * 测试长时间连接是否会出现断连问题
 *
 * 这个测试程序会：
 * 1. 连接到服务器并登录
 * 2. 保持连接一段时间（默认120秒）
 * 3. 定期检查连接状态
 * 4. 记录所有连接状态变化和断连事件
 */

interface TestConfig {
  endpoint: string;
  username: string;
  password: string;
  testDuration: number;  // 测试持续时间（秒）
  checkInterval: number;  // 检查间隔（秒）
}

class ConnectionTest {
  private client: FnosClient;
  private config: TestConfig;
  private disconnectCount = 0;
  private lastDisconnectTime: Date | null = null;
  private testStartTime: Date;
  private messageCount = 0;
  private pongCount = 0;
  private connectionStateChanges: Array<{ time: Date; from: string; to: string }> = [];
  private lastConnectionState: string = 'disconnected';

  constructor(config: TestConfig) {
    this.config = config;
    this.client = new FnosClient();
    this.testStartTime = new Date();

    // 设置消息回调
    this.client.onMessage(this.handleMessage.bind(this));
  }

  private handleMessage(message: string): void {
    this.messageCount++;

    try {
      const data = JSON.parse(message);
      if ('res' in data && data.res === 'pong') {
        this.pongCount++;
        console.log(`[${new Date().toISOString()}] 收到心跳响应 pong (总计: ${this.pongCount})`);
      } else {
        console.log(`[${new Date().toISOString()}] 收到消息: ${message.substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`[${new Date().toISOString()}] 收到非JSON消息: ${message.substring(0, 100)}...`);
    }
  }

  private async checkConnection(): Promise<boolean> {
    const isConnected = this.client.isConnected();
    const elapsed = Math.floor((new Date().getTime() - this.testStartTime.getTime()) / 1000);

    if (!isConnected) {
      this.disconnectCount++;
      this.lastDisconnectTime = new Date();
      console.error(`[${new Date().toISOString()}] ⚠️  检测到连接断开！`);
      console.error(`  - 测试已运行: ${elapsed} 秒`);
      console.error(`  - 断连次数: ${this.disconnectCount}`);
      console.error(`  - 总消息数: ${this.messageCount}`);
      console.error(`  - Pong响应数: ${this.pongCount}`);
      return false;
    }

    console.log(`[${new Date().toISOString()}] ✓ 连接正常 (${elapsed}秒) - 消息数: ${this.messageCount}, Pong: ${this.pongCount}`);
    return true;
  }

  private async performUserAction(): Promise<void> {
    // 每隔一段时间执行一些用户操作，保持连接活跃
    try {
      const user = new User(this.client);
      const userInfo = await user.getInfo();
      console.log(`[${new Date().toISOString()}] ✓ 执行用户操作成功 - 用户名: ${userInfo.data?.name || 'N/A'}`);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] ✗ 用户操作失败: ${e}`);
    }
  }

  private monitorConnectionState(): void {
    const currentState = this.client.isConnected() ? 'connected' : 'disconnected';

    if (currentState !== this.lastConnectionState) {
      this.connectionStateChanges.push({
        time: new Date(),
        from: this.lastConnectionState,
        to: currentState
      });
      this.lastConnectionState = currentState;

      const elapsed = Math.floor((new Date().getTime() - this.testStartTime.getTime()) / 1000);
      console.log(`[${new Date().toISOString()}] ⚡ 连接状态变化: ${currentState} (运行 ${elapsed} 秒)`);

      if (currentState === 'disconnected') {
        this.disconnectCount++;
        this.lastDisconnectTime = new Date();
        console.error(`[${new Date().toISOString()}] ⚠️  检测到连接断开！断连次数: ${this.disconnectCount}`);
      }
    }
  }

  public async run(): Promise<void> {
    console.log('='.repeat(80));
    console.log('长时间连接测试');
    console.log('='.repeat(80));
    console.log(`测试配置:`);
    console.log(`  - 服务器地址: ${this.config.endpoint}`);
    console.log(`  - 用户名: ${this.config.username}`);
    console.log(`  - 测试持续时间: ${this.config.testDuration} 秒`);
    console.log(`  - 检查间隔: ${this.config.checkInterval} 秒`);
    console.log('='.repeat(80));

    try {
      // 1. 连接
      console.log(`\n[${new Date().toISOString()}] 步骤 1: 连接到服务器...`);
      await this.client.connect(this.config.endpoint);
      console.log(`[${new Date().toISOString()}] ✓ 连接成功`);

      // 2. 登录
      console.log(`\n[${new Date().toISOString()}] 步骤 2: 登录...`);
      const loginResult = await this.client.login(this.config.username, this.config.password);
      if (loginResult.result === 'succ') {
        console.log(`[${new Date().toISOString()}] ✓ 登录成功`);
      } else {
        throw new Error(`登录失败: ${loginResult.msg || '未知错误'}`);
      }

      // 3. 执行初始用户操作
      console.log(`\n[${new Date().toISOString()}] 步骤 3: 执行初始用户操作...`);
      await this.performUserAction();

      // 4. 保持连接并定期检查
      console.log(`\n[${new Date().toISOString()}] 步骤 4: 开始长时间连接测试 (${this.config.testDuration}秒)...`);
      console.log('-'.repeat(80));

      const checkCount = Math.ceil(this.config.testDuration / this.config.checkInterval);

      for (let i = 1; i <= checkCount; i++) {
        await this.sleep(this.config.checkInterval * 1000);

        const elapsed = i * this.config.checkInterval;
        console.log(`\n[${new Date().toISOString()}] === 第 ${i} 次检查 (${elapsed}/${this.config.testDuration}秒) ===`);

        // 监控连接状态变化
        this.monitorConnectionState();

        // 检查连接状态
        const isConnected = await this.checkConnection();

        if (!isConnected) {
          console.error(`\n⚠️  检测到连接断开！测试终止。`);
          console.error(`  提示: 如需自动重连，请用户在检测到断连时手动调用 client.reconnect()`);
          break;
        }

        // 每次检查都执行用户操作，保持连接活跃
        console.log(`\n[${new Date().toISOString()}] 执行用户操作...`);
        await this.performUserAction();

        // 如果已经达到测试时长，退出循环
        if (elapsed >= this.config.testDuration) {
          break;
        }
      }

      // 5. 测试总结
      this.printSummary();

    } catch (e) {
      console.error(`\n❌ 测试过程中发生错误: ${e}`);
      this.printSummary();
      throw e;
    } finally {
      // 关闭连接
      console.log(`\n[${new Date().toISOString()}] 关闭连接...`);
      this.client.close();
      console.log(`[${new Date().toISOString()}] ✓ 连接已关闭`);
    }
  }

  private printSummary(): void {
    const testDuration = Math.floor((new Date().getTime() - this.testStartTime.getTime()) / 1000);

    console.log('\n' + '='.repeat(80));
    console.log('测试总结');
    console.log('='.repeat(80));
    console.log(`  - 测试时长: ${testDuration} 秒`);
    console.log(`  - 断连次数: ${this.disconnectCount}`);
    console.log(`  - 总消息数: ${this.messageCount}`);
    console.log(`  - Pong响应数: ${this.pongCount}`);
    console.log(`  - 最后断连时间: ${this.lastDisconnectTime ? this.lastDisconnectTime.toISOString() : '无'}`);

    if (this.disconnectCount > 0) {
      const averageTimeBetweenDisconnects = testDuration / this.disconnectCount;
      console.log(`  - 平均断连间隔: ${averageTimeBetweenDisconnects.toFixed(2)} 秒`);
      console.log(`\n⚠️  检测到 ${this.disconnectCount} 次断连！`);
      console.log(`   建议检查：`);
      console.log(`   1. 心跳间隔是否合适（当前15秒）`);
      console.log(`   2. 服务器空闲超时设置`);
      console.log(`   3. 网络连接稳定性`);
    } else {
      console.log(`\n✓ 测试期间未检测到断连`);
    }
    console.log('='.repeat(80));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        const name = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result[name] = value;
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
        const name = arg.slice(1, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result[name] = value;
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
  // 从命令行参数获取
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  const user = parsed['user'];
  const password = parsed['password'];
  const endpoint = parsed['e'] || parsed['endpoint'] || 'your-custom-endpoint.com:5666';
  const testDuration = parseInt(parsed['d'] || parsed['duration'] || '120', 10);
  const checkInterval = parseInt(parsed['i'] || parsed['interval'] || '10', 10);

  if (!user || !password) {
    console.error(`用法: tsx examples/test_long_connection.ts --user <用户名> --password <密码> [-e <服务器地址>] [-d <测试时长(秒)>] [-i <检查间隔(秒)>]`);
    console.error(`  或: tsx examples/test_long_connection.ts --user=<用户名> --password=<密码> [-e=<服务器地址>] [-d=<测试时长(秒)>] [-i=<检查间隔(秒)>]`);
    console.error(`\n参数说明:`);
    console.error(`  --user      用户名（必需）`);
    console.error(`  --password  密码（必需）`);
    console.error(`  -e, --endpoint  服务器地址（默认: your-custom-endpoint.com:5666）`);
    console.error(`  -d, --duration  测试持续时间（秒，默认: 120）`);
    console.error(`  -i, --interval  检查间隔（秒，默认: 10）`);
    console.error(`\n错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  const config: TestConfig = {
    endpoint,
    username: user,
    password,
    testDuration,
    checkInterval
  };

  const test = new ConnectionTest(config);
  await test.run();
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});