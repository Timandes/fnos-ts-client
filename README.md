# fnos

飞牛 fnOS 的 TypeScript SDK。

*注意：这个 SDK 非官方提供。*

## 项目信息

- **源代码仓库**: [https://github.com/Timandes/pyfnos](https://github.com/Timandes/pyfnos) (Python 版本参考)
- **版本**: 0.1.0

## 项目结构

```
fnos/
├── src/
│   ├── client.ts           # FnosClient 核心类
│   ├── crypto.ts           # 加密工具类 (RSA + AES + HMAC)
│   ├── exceptions.ts       # 异常类
│   ├── resource_monitor.ts # 资源监控类
│   ├── store.ts            # 存储类
│   ├── sac.ts              # SAC 类
│   ├── system_info.ts      # 系统信息类
│   ├── user.ts             # 用户类
│   ├── network.ts          # 网络类
│   ├── file.ts             # 文件类
│   ├── index.ts            # 主入口文件
│   └── test/
│       └── crypto.test.ts  # 加密库单元测试
├── examples/               # 示例脚本
│   ├── demo.ts
│   ├── resource_monitor.ts
│   ├── resource_monitor_general.ts
│   ├── user.ts
│   ├── network.ts
│   ├── file.ts
│   ├── sac.ts
│   ├── store.ts
│   ├── system_info.ts
│   ├── login_via_token.ts
│   ├── not_connected.ts
│   └── reconnect.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 安装

```bash
npm install
```

## 编译

```bash
npm run build
```

## 运行测试

```bash
npm test
```

## 使用示例

### 基本使用

```typescript
import { FnosClient } from './src/index.js';

async function main() {
  const client = new FnosClient();

  // 设置消息回调
  client.onMessage((message) => {
    console.log(`收到消息: ${message}`);
  });

  // 连接到服务器
  await client.connect('nas-9.timandes.net:5666');

  // 登录
  const result = await client.login('SystemMonitor', 'password');
  console.log('登录结果:', result);

  // 关闭连接
  client.close();
}

main().catch(console.error);
```

### 运行示例脚本

```bash
# 基本示例
npx tsx examples/demo.ts --user=SystemMonitor --password=password -e=nas-9.timandes.net:5666

# 资源监控示例
npx tsx examples/resource_monitor.ts --user=SystemMonitor --password=password -e=nas-9.timandes.net:5666

# 用户模块示例
npx tsx examples/user.ts --user=SystemMonitor --password=password -e=nas-9.timandes.net:5666

# 其他示例...
```

## API 参考

### FnosClient

| 方法名 | 简介 |
| ---- | ---- |
| `__init__` | 初始化客户端，支持 type 参数（"main"、"timer"或"file"，默认为"main"） |
| `connect` | 连接到 WebSocket 服务器（必填参数：endpoint） |
| `login` | 用户登录方法 |
| `loginViaToken` | 使用 token 登录方法 |
| `getDecryptedSecret` | 获取解密后的 secret |
| `onMessage` | 设置消息回调函数 |
| `request` | 发送请求 |
| `requestPayload` | 以 payload 为主体发送请求 |
| `requestPayloadWithResponse` | 以 payload 为主体发送请求并返回响应 |
| `reconnect` | 重新连接到服务器 |
| `close` | 关闭 WebSocket 连接 |
| `isConnected` | 获取连接状态 |

### ResourceMonitor

| 方法名 | 简介 |
| ---- | ---- |
| `cpu` | 请求 CPU 资源监控信息 |
| `gpu` | 请求 GPU 资源监控信息 |
| `memory` | 请求内存资源监控信息 |
| `disk` | 请求磁盘资源监控信息 |
| `net` | 请求网络资源监控信息 |
| `general` | 请求通用资源监控信息 |

### Store

| 方法名 | 简介 |
| ---- | ---- |
| `general` | 请求存储通用信息 |
| `calculateSpace` | 计算存储空间信息 |
| `listDisks` | 列出磁盘信息 |
| `getDiskSmart` | 获取磁盘 SMART 信息 |
| `getState` | 获取存储状态信息 |

### SAC

| 方法名 | 简介 |
| ---- | ---- |
| `upsStatus` | 请求 UPS 状态信息 |

### SystemInfo

| 方法名 | 简介 |
| ---- | ---- |
| `getHostName` | 请求主机名信息 |
| `getTrimVersion` | 请求 Trim 版本信息 |
| `getMachineId` | 请求机器 ID 信息 |
| `getHardwareInfo` | 请求硬件信息 |
| `getUptime` | 请求系统运行时间信息 |

### User

| 方法名 | 简介 |
| ---- | ---- |
| `getInfo` | 获取用户信息 |
| `listUserGroups` | 请求用户和组列表信息 |
| `groupUsers` | 请求用户分组信息 |
| `isAdmin` | 检查当前用户是否为管理员 |

### Network

| 方法名 | 简介 |
| ---- | ---- |
| `list` | 列出网络信息 |
| `detect` | 检测网络接口 |

### File

| 方法名 | 简介 |
| ---- | ---- |
| `list` | 列出指定目录下的文件和文件夹 |
| `mkdir` | 创建文件夹 |
| `remove` | 删除文件或文件夹 |

## 加密实现

本项目使用 Node.js 内置的 `crypto` 模块实现了与 pyfnos 项目完全一致的加密功能：

- **RSA**: 使用 RSA-PKCS1-v1_5 填充进行公钥加密
- **AES**: 使用 AES-256-CBC 模式进行对称加密
- **HMAC**: 使用 HMAC-SHA256 进行消息认证

## 许可证

Apache License 2.0
