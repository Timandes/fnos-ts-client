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

import { FnosClient, User } from '../src/index.js';

/**
 * 连接稳定性测试程序
 *
 * 这个程序专门用于测试长时间连接的稳定性，提供详细的诊断信息
 *
 * 测试场景：
 * 1. 空闲连接测试：保持连接但不发送任何数据
 * 2. 活跃连接测试：保持连接并定期执行操作
 * 3. 心跳测试：验证心跳机制是否正常工作
 */

interface TestConfig {
  endpoint: string;
  username: string;
  password: string;
  duration: number;        // 测试持续时间（秒）
  checkInterval: number;   // 检查间隔（秒）
  scenario: 'idle' | 'active' | 'heartbeat';  // 测试场景
}

interface TestResult {
  duration: number;
  disconnectCount: number;
  messageCount: number;
  pongCount: number;
  userActionCount: number;
  userActionSuccessCount: number;
  connectionStateChanges: Array<{ time: Date; from: string; to: string }>;
  testPassed: boolean;
  errors: Array<{ time: Date; message: string }>;
}

class ConnectionStabilityTest {
  private client: FnosClient;
  private config: TestConfig;
  private startTime: Date;
  private result: TestResult;
  private lastConnectionState: string = 'disconnected';

  constructor(config: TestConfig) {
    this.config = config;
    this.client = new FnosClient();
    this.startTime = new Date();

    this.result = {
      duration: 0,
      disconnectCount: 0,
      messageCount: 0,
      pongCount: 0,
      userActionCount: 0,
      userActionSuccessCount: 0,
      connectionStateChanges: [],
      testPassed: false,
      errors: []
    };

    // 设置消息回调
    this.client.onMessage(this.handleMessage.bind(this));
  }

  private handleMessage(message: string): void {
    this.result.messageCount++;

    try {
      const data = JSON.parse(message);
      if ('res' in data && data.res === 'pong') {
        this.result.pongCount++;
        console.log(`[${new Date().toISOString()}] 💓 收到心跳响应 pong (总计: ${this.result.pongCount})`);
      } else {
        console.log(`[${new Date().toISOString()}] 📨 收到消息: ${message.substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`[${new Date().toISOString()}] 📨 收到非JSON消息: ${message.substring(0, 100)}...`);
    }
  }

  private monitorConnectionState(): void {
    const currentState = this.client.isConnected() ? 'connected' : 'disconnected';

    if (currentState !== this.lastConnectionState) {
      this.result.connectionStateChanges.push({
        time: new Date(),
        from: this.lastConnectionState,
        to: currentState
      });
      this.lastConnectionState = currentState;

      const elapsed = Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
      console.log(`[${new Date().toISOString()}] ⚡ 连接状态变化: ${currentState} (运行 ${elapsed} 秒)`);

      if (currentState === 'disconnected') {
        this.result.disconnectCount++;
        console.error(`[${new Date().toISOString()}] ⚠️  检测到连接断开！断连次数: ${this.result.disconnectCount}`);
      }
    }
  }

  private async performUserAction(): Promise<boolean> {
    this.result.userActionCount++;

    try {
      const user = new User(this.client);
      const userInfo = await user.getInfo();
      console.log(`[${new Date().toISOString()}] ✓ 用户操作成功 - 用户名: ${userInfo.data?.name || 'N/A'}`);
      this.result.userActionSuccessCount++;
      return true;
    } catch (e) {
      const errorMsg = `用户操作失败: ${e}`;
      console.error(`[${new Date().toISOString()}] ✗ ${errorMsg}`);
      this.result.errors.push({ time: new Date(), message: errorMsg });
      return false;
    }
  }

  private printTestPlan(): void {
    console.log('='.repeat(80));
    console.log('连接稳定性测试');
    console.log('='.repeat(80));
    console.log(`测试配置:`);
    console.log(`  - 服务器地址: ${this.config.endpoint}`);
    console.log(`  - 用户名: ${this.config.username}`);
    console.log(`  - 测试场景: ${this.config.scenario}`);
    console.log(`  - 测试持续时间: ${this.config.duration} 秒`);
    console.log(`  - 检查间隔: ${this.config.checkInterval} 秒`);
    console.log('='.repeat(80));
  }

  public async run(): Promise<TestResult> {
    this.printTestPlan();

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

      // 3. 根据场景执行测试
      console.log(`\n[${new Date().toISOString()}] 步骤 3: 开始测试 (场景: ${this.config.scenario})...`);
      console.log('-'.repeat(80));

      // 登录后立即执行一次操作，避免服务器空闲超时
      console.log(`\n[${new Date().toISOString()}] 登录后立即执行操作...`);
      this.monitorConnectionState();
      if (this.config.scenario === 'active') {
        await this.performUserAction();
      }

      const checkCount = Math.ceil(this.config.duration / this.config.checkInterval);

      for (let i = 1; i <= checkCount; i++) {
        await this.sleep(this.config.checkInterval * 1000);

        const elapsed = i * this.config.checkInterval;
        console.log(`\n[${new Date().toISOString()}] === 第 ${i} 次检查 (${elapsed}/${this.config.duration}秒) ===`);

        // 监控连接状态
        this.monitorConnectionState();

        // 根据场景执行不同的操作
        if (this.config.scenario === 'idle') {
          // 空闲场景：只检查连接状态，不执行任何操作
          const isConnected = this.client.isConnected();
          console.log(`[${new Date().toISOString()}] 连接状态: ${isConnected ? '已连接' : '已断开'}`);
        } else if (this.config.scenario === 'active') {
          // 活跃场景：定期执行用户操作
          console.log(`[${new Date().toISOString()}] 执行用户操作...`);
          const success = await this.performUserAction();
          if (!success) {
            console.error(`[${new Date().toISOString()}] ⚠️  用户操作失败，可能连接已断开`);
          }
        } else if (this.config.scenario === 'heartbeat') {
          // 心跳场景：监控心跳响应
          const isConnected = this.client.isConnected();
          console.log(`[${new Date().toISOString()}] 连接状态: ${isConnected ? '已连接' : '已断开'}`);
          console.log(`[${new Date().toISOString()}] 心跳统计: ${this.result.pongCount} 个 pong 响应`);
        }

        // 如果已经达到测试时长，退出循环
        if (elapsed >= this.config.duration) {
          break;
        }
      }

      // 4. 计算测试结果
      this.result.duration = Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
      this.result.testPassed = this.result.disconnectCount === 0;

    } catch (e) {
      const errorMsg = `测试过程中发生错误: ${e}`;
      console.error(`\n❌ ${errorMsg}`);
      this.result.errors.push({ time: new Date(), message: errorMsg });
    } finally {
      // 关闭连接
      console.log(`\n[${new Date().toISOString()}] 关闭连接...`);
      this.client.close();
      console.log(`[${new Date().toISOString()}] ✓ 连接已关闭`);
    }

    // 打印测试结果
    this.printResult();

    return this.result;
  }

  private printResult(): void {
    console.log('\n' + '='.repeat(80));
    console.log('测试结果');
    console.log('='.repeat(80));
    console.log(`  - 测试时长: ${this.result.duration} 秒`);
    console.log(`  - 断连次数: ${this.result.disconnectCount}`);
    console.log(`  - 总消息数: ${this.result.messageCount}`);
    console.log(`  - Pong响应数: ${this.result.pongCount}`);
    console.log(`  - 用户操作数: ${this.result.userActionCount}`);
    console.log(`  - 用户操作成功数: ${this.result.userActionSuccessCount}`);
    console.log(`  - 连接状态变化次数: ${this.result.connectionStateChanges.length}`);
    console.log(`  - 错误数: ${this.result.errors.length}`);
    console.log(`  - 测试结果: ${this.result.testPassed ? '✓ 通过' : '✗ 失败'}`);

    if (this.result.disconnectCount > 0) {
      const averageTimeBetweenDisconnects = this.result.duration / this.result.disconnectCount;
      console.log(`\n⚠️  检测到 ${this.result.disconnectCount} 次断连！`);
      console.log(`   平均断连间隔: ${averageTimeBetweenDisconnects.toFixed(2)} 秒`);

      console.log(`\n连接状态变化记录:`);
      for (const change of this.result.connectionStateChanges) {
        console.log(`   - ${change.time.toISOString()}: ${change.from} -> ${change.to}`);
      }
    }

    if (this.result.errors.length > 0) {
      console.log(`\n错误记录:`);
      for (const error of this.result.errors) {
        console.log(`   - ${error.time.toISOString()}: ${error.message}`);
      }
    }

    if (this.result.testPassed) {
      console.log(`\n✓ 测试通过！连接保持稳定。`);
    } else {
      console.log(`\n✗ 测试失败！连接出现断连。`);
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
  const duration = parseInt(parsed['d'] || parsed['duration'] || '60', 10);
  const checkInterval = parseInt(parsed['i'] || parsed['interval'] || '5', 10);
  const scenario = parsed['s'] || parsed['scenario'] || 'active';

  if (!user || !password) {
    console.error(`用法: tsx examples/connection_stability_test.ts --user <用户名> --password <密码> [-e <服务器地址>] [-d <测试时长(秒)>] [-i <检查间隔(秒)>] [-s <测试场景>]`);
    console.error(`\n参数说明:`);
    console.error(`  --user      用户名（必需）`);
    console.error(`  --password  密码（必需）`);
    console.error(`  -e, --endpoint  服务器地址（默认: your-custom-endpoint.com:5666）`);
    console.error(`  -d, --duration  测试持续时间（秒，默认: 60）`);
    console.error(`  -i, --interval  检查间隔（秒，默认: 5）`);
    console.error(`  -s, --scenario  测试场景（idle|active|heartbeat，默认: active）`);
    console.error(`\n测试场景:`);
    console.error(`  idle       - 空闲连接测试：保持连接但不发送任何数据`);
    console.error(`  active     - 活跃连接测试：保持连接并定期执行操作`);
    console.error(`  heartbeat  - 心跳测试：监控心跳响应`);
    console.error(`\n错误: 必须提供 --user 和 --password 参数`);
    process.exit(1);
  }

  if (scenario !== 'idle' && scenario !== 'active' && scenario !== 'heartbeat') {
    console.error(`错误: 测试场景必须是 'idle'、'active' 或 'heartbeat'`);
    process.exit(1);
  }

  const config: TestConfig = {
    endpoint,
    username: user,
    password,
    duration,
    checkInterval,
    scenario: scenario as 'idle' | 'active' | 'heartbeat'
  };

  const test = new ConnectionStabilityTest(config);
  const result = await test.run();

  // 返回退出码
  process.exit(result.testPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});