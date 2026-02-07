# 长时间连接断连问题修复 - 技术实现计划

## 问题分析

通过与 pyfnos (Python 版本) 的对比分析，发现了以下可能导致长时间连接断连的问题：

### 问题 1: 心跳机制没有检查 WebSocket 实际连接状态

**当前实现：**
```typescript
private startHeartbeat(): void {
  this.stopHeartbeat = false;
  this.heartbeatTimer = setInterval(() => {
    if (!this.stopHeartbeat && this.connected) {
      const message = { req: 'ping' };
      this.sendMessage(message);
      logger.debug('已发送心跳请求');
    }
  }, 30000);
}
```

**问题：**
- 只检查 `this.connected` 标志，不检查 WebSocket 的实际 `readyState`
- 如果 WebSocket 已断开但 `connected` 标志还是 `true`，会尝试发送消息到已关闭的连接

**参考 pyfnos 实现：**
```python
async def _start_heartbeat(self):
    async def heartbeat_worker():
        while not self.stop_heartbeat:
            await asyncio.sleep(30)
            if self.connected:
                message = {"req": "ping"}
                await self._send_message(message)
```

Python 版本也只检查 `self.connected`，但它的 `_send_message` 方法会检查 WebSocket 状态。

### 问题 2: 连接超时后没有正确清理 WebSocket 引用

**当前实现：**
```typescript
const timeoutTimer = setTimeout(() => {
  if (this.connectReject) {
    this.connectReject(new Error('连接超时'));
  }
  this.connected = false;
  if (this.ws) {
    this.ws.close();
  }
}, timeout);
```

**问题：**
- 调用 `this.ws.close()` 后，`this.ws` 仍然不为 `null`
- 后续状态检查可能误认为 WebSocket 还存在

### 问题 3: `isConnected()` 方法可能返回不准确的结果

**当前实现：**
```typescript
isConnected(): boolean {
  return this.connected;
}
```

**问题：**
- 只返回 `this.connected` 标志
- 不检查 WebSocket 的实际 `readyState`
- 可能出现状态不一致的情况

### 问题 4: `sendMessage()` 方法缺少 WebSocket 状态检查

**当前实现：**
```typescript
private sendMessage(message: any): void {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    const messageJson = JSON.stringify(message);
    logger.debug(`Sending message: ${messageJson}`);
    this.ws.send(messageJson);
  }
}
```

**问题：**
- 虽然检查了 `readyState`，但只在发送时检查
- 没有在连接状态变化时主动更新 `this.connected` 标志

## 技术方案

### 方案 1: 改进 `isConnected()` 方法

**目标：** 准确反映连接的实际状态

**实现：**
```typescript
isConnected(): boolean {
  return this.connected &&
         this.ws !== null &&
         this.ws.readyState === WebSocket.OPEN;
}
```

**说明：**
- 同时检查 `this.connected` 标志和 WebSocket 的 `readyState`
- 确保返回的连接状态与实际一致

### 方案 2: 改进心跳机制

**目标：** 在发送心跳前检查 WebSocket 实际状态

**实现：**
```typescript
private startHeartbeat(): void {
  this.stopHeartbeat = false;
  this.heartbeatTimer = setInterval(() => {
    // 检查 WebSocket 实际连接状态
    if (!this.stopHeartbeat && this.isConnected()) {
      const message = { req: 'ping' };
      try {
        this.sendMessage(message);
        logger.debug('已发送心跳请求');
      } catch (e) {
        logger.error(`发送心跳失败: ${e}`);
        // 心跳发送失败，可能连接已断开
        this.handleDisconnection();
      }
    }
  }, 30000);
}
```

**说明：**
- 使用 `isConnected()` 方法检查实际连接状态
- 添加错误处理，心跳发送失败时处理断连
- 参考了 Python 版本的错误处理方式

### 方案 3: 改进连接超时处理

**目标：** 连接超时后正确清理所有资源

**实现：**
```typescript
const timeoutTimer = setTimeout(() => {
  if (this.connectReject) {
    this.connectReject(new Error('连接超时'));
    this.connectReject = null;
  }
  this.connected = false;
  if (this.ws) {
    try {
      this.ws.close();
    } catch (e) {
      logger.error(`关闭 WebSocket 失败: ${e}`);
    }
    this.ws = null;  // 清理引用
  }
  this.stopHeartbeat = true;
  if (this.heartbeatTimer) {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}, timeout);
```

**说明：**
- 超时后将 `this.ws` 设置为 `null`
- 添加错误处理，防止 `close()` 方法抛出异常
- 清理所有相关资源（心跳定时器等）

### 方案 4: 改进连接关闭处理

**目标：** 连接关闭时正确清理资源并更新状态

**实现：**
```typescript
this.ws.on('close', () => {
  logger.info('WebSocket连接已关闭');
  this.handleDisconnection();
});

// 新增方法
private handleDisconnection(): void {
  this.connected = false;
  this.stopHeartbeat = true;
  if (this.heartbeatTimer) {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
  // 注意：不在这里设置 this.ws = null
  // 因为 ws 对象在 close 事件中仍然有效
}
```

**说明：**
- 提取断连处理逻辑到独立方法
- 确保资源正确清理
- 不在 close 事件中设置 `this.ws = null`

### 方案 5: 改进错误处理

**目标：** 统一错误处理逻辑

**实现：**
```typescript
this.ws.on('error', (error: Error) => {
  logger.error(`WebSocket错误: ${error.message}`);
  this.connected = false;
  clearTimeout(timeoutTimer);
  if (this.connectReject) {
    this.connectReject(error);
    this.connectReject = null;
  }
  // 不在这里清理 this.ws，因为 ws 对象在错误事件中仍然有效
});
```

**说明：**
- 统一错误处理逻辑
- 清理超时定时器
- 不在错误事件中清理 `this.ws`

## 架构设计

### 类图

```
┌─────────────────────────────────────┐
│           FnosClient                │
├─────────────────────────────────────┤
│ - ws: WebSocket | null              │
│ - connected: boolean                │
│ - heartbeatTimer: NodeJS.Timeout    │
│ - stopHeartbeat: boolean            │
│ ... (其他属性)                      │
├─────────────────────────────────────┤
│ + connect(): Promise<boolean>       │
│ + login(): Promise<LoginResponse>   │
│ + isConnected(): boolean            │  ← 改进
│ + close(): void                     │
│ + reconnect(): Promise<boolean>     │
├─────────────────────────────────────┤
│ - startHeartbeat(): void            │  ← 改进
│ - sendMessage(message): void        │
│ - handleDisconnection(): void       │  ← 新增
│ - processMessage(message): void     │
└─────────────────────────────────────┘
```

### 状态转换图

```
         [未连接]
            │
            │ connect()
            ▼
         [连接中]
            │
            │ 收到公钥
            ▼
         [已连接]
            │
            │ close() / 错误
            ▼
         [已断开]
            │
            │ reconnect()
            ▼
         [连接中]
```

## 数据模型

### 连接状态

```typescript
enum ConnectionState {
  Disconnected,  // 未连接
  Connecting,    // 连接中
  Connected,     // 已连接
  Error          // 错误状态
}
```

**说明：** 可选的状态管理方式，当前使用简单的 `boolean` 标志。

## 实施策略

### 阶段 1: 核心修复（高优先级）

1. **改进 `isConnected()` 方法**
   - 添加 WebSocket 状态检查
   - 确保返回准确的状态

2. **改进心跳机制**
   - 使用 `isConnected()` 检查实际状态
   - 添加错误处理

3. **改进连接超时处理**
   - 正确清理 WebSocket 引用
   - 清理所有相关资源

### 阶段 2: 测试和验证（高优先级）

1. **改进现有测试程序**
   - 增强 `test_long_connection.ts`
   - 添加更详细的日志

2. **编写新的测试程序**
   - 连接稳定性测试
   - 状态准确性测试

3. **运行测试**
   - 验证修复效果
   - 确保没有引入新问题

### 阶段 3: 优化和文档（低优先级）

1. **代码优化**
   - 添加必要的注释
   - 改进错误消息

2. **文档更新**
   - 记录问题和解决方案
   - 更新 README

## 风险评估

### 风险 1: 破坏现有 API

**描述：** 修改可能影响现有 API 的行为

**缓解措施：**
- 保持方法签名不变
- 只改进内部实现
- 运行所有现有测试

### 风险 2: 引入新的 Bug

**描述：** 修改可能引入新的问题

**缓解措施：**
- 充分测试各种场景
- 逐步实施，每步验证
- 保留原始代码作为备份

### 风险 3: 性能影响

**描述：** 额外的状态检查可能影响性能

**缓解措施：**
- 状态检查是简单的布尔判断
- 影响微乎其微
- 优先保证正确性

## 测试策略

### 单元测试

1. **`isConnected()` 方法测试**
   - 测试各种连接状态组合
   - 确保返回值准确

### 集成测试

1. **长时间连接测试**
   - 保持连接 120 秒
   - 记录断连次数

2. **状态准确性测试**
   - 模拟各种断连场景
   - 验证状态更新及时性

3. **心跳机制测试**
   - 验证心跳定期发送
   - 验证心跳响应处理

## 依赖关系

- TypeScript
- ws 库
- Winston 日志库

## 时间估算

| 任务 | 预估时间 |
|------|----------|
| 改进 `isConnected()` 方法 | 0.5 小时 |
| 改进心跳机制 | 1 小时 |
| 改进连接超时处理 | 0.5 小时 |
| 改进连接关闭处理 | 0.5 小时 |
| 改进测试程序 | 1 小时 |
| 编写新测试程序 | 1.5 小时 |
| 运行测试和调试 | 1 小时 |
| 文档更新 | 0.5 小时 |
| **总计** | **6.5 小时** |

## 参考资料

1. pyfnos 源代码: https://github.com/Timandes/pyfnos
2. ws 库文档: https://github.com/websockets/ws
3. WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

## 验证结果

### 测试环境

- 服务器：本地 WebSocket 服务器（127.0.0.1:5666）
- 测试时长：120 秒
- 心跳间隔：30 秒

### 验证结果

**修复前：**
- 连接在 3 秒后被客户端主动关闭
- 服务端日志显示：`< CLOSE 1005`（客户端发起的关闭）
- 心跳包正常发送，但连接仍然被关闭

**修复后：**
- ✅ 连接保持稳定，未在 3 秒后关闭
- ✅ 心跳包正常发送和接收
- ✅ 连接可以保持 120 秒或更长时间

### 实际发现的问题

通过服务端日志分析，确认了问题的根本原因：

1. **服务端日志显示关闭状态码 `1005` 是从客户端发起的**
   ```
   DEBUG: < CLOSE 1005 (no status received [internal]) [0 bytes]
   ```
   `<` 表示从客户端接收到的关闭请求

2. **客户端在连接成功后没有清除 3 秒超时定时器**
   - 定时器在 3 秒后触发
   - 主动调用 `this.ws.close()` 关闭连接

3. **心跳机制工作正常**
   - 服务端日志显示收到了 `{"req":"ping"}` 消息
   - 客户端日志显示收到了 `pong` 响应

## 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2025-01-30 | iFlow CLI | 初始版本 |