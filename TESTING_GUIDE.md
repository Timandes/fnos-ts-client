# 连接稳定性测试指南

## 概述

本文档说明如何验证长时间连接断连问题的修复效果。

## 修复内容

### 1. 清除连接超时定时器（核心修复）

**问题：**
连接超时定时器在连接成功后没有被清除，导致 3 秒后被主动关闭。

**修改：**
```typescript
// 添加成员变量
private connectTimeoutTimer: NodeJS.Timeout | null = null;

// 在连接成功后清除
if (this.connectTimeoutTimer) {
  clearTimeout(this.connectTimeoutTimer);
  this.connectTimeoutTimer = null;
}
```

**效果：**
- 连接成功后不会被超时定时器主动关闭
- 连接可以保持更长时间

### 2. 改进心跳机制

**修改：**
```typescript
private startHeartbeat(): void {
  this.stopHeartbeat = false;

  // 立即发送第一个心跳包
  const sendHeartbeat = () => {
    if (!this.stopHeartbeat && this.isConnected()) {
      const message = { req: 'ping' };
      try {
        this.sendMessage(message);
        logger.debug('已发送心跳请求');
      } catch (e) {
        logger.error(`发送心跳失败: ${e}`);
        this.handleDisconnection();
      }
    }
  };

  // 立即发送第一个心跳
  sendHeartbeat();

  // 然后每30秒发送一次
  this.heartbeatTimer = setInterval(sendHeartbeat, 30000);
}
```

**效果：**
- 心跳机制更可靠
- 能够更快地保持连接活跃

### 3. 改进 `isConnected()` 方法

**修改：**
```typescript
isConnected(): boolean {
  return this.connected &&
         this.ws !== null &&
         this.ws.readyState === WebSocket.OPEN;
}
```

**效果：**
- 准确反映连接的实际状态
- 避免状态不一致的问题

### 4. 添加 `handleDisconnection()` 辅助方法

**新增方法：**
```typescript
private handleDisconnection(): void {
  this.connected = false;
  this.stopHeartbeat = true;
  if (this.heartbeatTimer) {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
```

**效果：**
- 统一断连处理逻辑
- 避免代码重复
- 确保资源正确清理

### 5. 改进错误处理

**修改：**
- 清理 `connectTimeoutTimer` 引用
- 清理 `connectReject` 引用
- 调用统一的断连处理方法

**效果：**
- 错误处理更加完善
- 避免引用未清理的问题

### 6. 改进 `close()` 方法

**修改：**
- 添加错误处理
- 清理所有定时器（心跳定时器和连接超时定时器）

**效果：**
- 关闭连接更加可靠
- 不会因为异常导致资源未清理

## 测试方法

### 测试程序

项目提供了两个测试程序：

1. **`test_long_connection.ts`** - 长时间连接测试
2. **`connection_stability_test.ts`** - 连接稳定性测试（新增）

### 运行测试

#### 1. 长时间连接测试

```bash
tsx examples/test_long_connection.ts --user <用户名> --password <密码> -e <服务器地址> -d 120 -i 10
```

**参数说明：**
- `--user`: 用户名（必需）
- `--password`: 密码（必需）
- `-e, --endpoint`: 服务器地址（默认: your-custom-endpoint.com:5666）
- `-d, --duration`: 测试持续时间（秒，默认: 120）
- `-i, --interval`: 检查间隔（秒，默认: 10）

**预期结果：**
- 测试期间应该没有断连（断连次数为 0）
- 心跳应该正常发送和接收
- 所有用户操作应该成功

#### 2. 连接稳定性测试

```bash
tsx examples/connection_stability_test.ts --user <用户名> --password <密码> -e <服务器地址> -d 60 -i 5 -s active
```

**参数说明：**
- `--user`: 用户名（必需）
- `--password`: 密码（必需）
- `-e, --endpoint`: 服务器地址（默认: your-custom-endpoint.com:5666）
- `-d, --duration`: 测试持续时间（秒，默认: 60）
- `-i, --interval`: 检查间隔（秒，默认: 5）
- `-s, --scenario`: 测试场景（idle|active|heartbeat，默认: active）

**测试场景：**
- `idle` - 空闲连接测试：保持连接但不发送任何数据
- `active` - 活跃连接测试：保持连接并定期执行操作
- `heartbeat` - 心跳测试：监控心跳响应

**预期结果：**
- 测试程序应该返回退出码 0（通过）
- 断连次数应该为 0
- 连接状态变化应该只有：disconnected -> connected

### 测试建议

1. **逐步测试**
   - 先运行短时间测试（30秒）
   - 逐步增加测试时长（60秒、120秒、300秒）
   - 验证修复效果是否稳定

2. **多场景测试**
   - 测试所有三种场景（idle、active、heartbeat）
   - 验证不同场景下的连接稳定性

3. **压力测试**
   - 运行长时间测试（5分钟以上）
   - 观察是否有断连

4. **网络波动测试**
   - 在网络不稳定的环境下测试
   - 验证客户端是否正确处理网络波动

## 验证要点

### 关键指标

1. **断连次数**
   - 目标：0 次断连
   - 监控：测试程序会记录断连次数

2. **心跳响应**
   - 目标：每 30 秒发送一次心跳
   - 监控：测试程序会记录 pong 响应数量

3. **用户操作成功率**
   - 目标：100% 成功率
   - 监控：测试程序会记录用户操作成功次数

4. **连接状态准确性**
   - 目标：`isConnected()` 返回准确的状态
   - 监控：测试程序会记录连接状态变化

### 日志分析

测试程序会输出详细的日志，包括：

- 连接状态变化
- 消息接收情况
- 心跳发送和接收
- 用户操作结果
- 错误信息

关注以下日志：
- `⚡ 连接状态变化` - 监控连接状态是否频繁变化
- `⚠️ 检测到连接断开` - 如果出现，说明有问题
- `💓 收到心跳响应 pong` - 验证心跳是否正常工作
- `✗ 用户操作失败` - 如果出现，说明连接可能有问题

## 问题排查

如果测试失败，请检查以下内容：

### 1. 网络连接
- 确认网络连接稳定
- 检查防火墙设置
- 尝试使用不同的网络环境

### 2. 服务器配置
- 确认服务器正常运行
- 检查服务器端的空闲超时设置
- 查看服务器日志

### 3. 客户端配置
- 确认使用的是修复后的代码
- 检查心跳间隔设置（默认 30 秒）
- 查看客户端日志

### 4. 测试环境
- 确认测试参数正确
- 检查测试时长是否足够
- 尝试不同的测试场景

## 参考文档

- spec.md - 需求规范
- plan.md - 技术实现计划
- tasks.md - 任务分解清单
- pyfnos - Python 参考实现

## 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2025-01-30 | iFlow CLI | 初始版本 |