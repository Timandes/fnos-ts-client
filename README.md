# fnos

飞牛 fnOS 的 TypeScript SDK。

*注意：这个 SDK 非官方提供。*

[![npm version](https://badge.fury.io/js/fnos.svg)](https://www.npmjs.com/package/fnos)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## 项目信息

- **源代码仓库**: [https://github.com/Timandes/fnos-ts-client](https://github.com/Timandes/fnos-ts-client)
- **问题追踪**: [GitHub Issues](https://github.com/Timandes/fnos-ts-client/issues)
- **更新日志**: [CHANGELOG.md](CHANGELOG.md)

## 项目结构

```
fnos/
├── src/
│   ├── client.ts           # FnosClient 核心类（支持 SSL/WSS）
│   ├── oauth_adapter.ts    # fnOS OAuth 授权、换码和刷新适配
│   ├── oauth_client.ts     # OAuth Bearer HTTP API 客户端
│   ├── request_client.ts   # 两种传输共用的请求接口
│   ├── crypto.ts           # 加密工具类 (RSA + AES + HMAC)
│   ├── exceptions.ts       # 异常类
│   ├── resource_monitor.ts # 资源监控类
│   ├── store.ts            # 存储类
│   ├── sac.ts              # SAC 类
│   ├── system_info.ts      # 系统信息类
│   ├── user.ts             # 用户类
│   ├── network.ts          # 网络类
│   ├── file.ts             # 文件类
│   ├── docker_manager.ts   # Docker 管理类
│   ├── event_logger.ts     # 事件日志类
│   ├── share.ts            # 共享配置类
│   ├── notify.ts           # 通知类
│   ├── iscsi_manager.ts    # iSCSI 管理类
│   ├── logger.ts           # 日志工具类
│   ├── index.ts            # 主入口文件
│   └── test/
│       ├── unit/           # 单元测试
│       │   ├── client.test.ts
│       │   └── crypto.test.ts
│       └── integration/    # 集成测试（连接 fnos-mock-server）
│           ├── helpers.ts
│           ├── system_info.test.ts
│           ├── file.test.ts
│           ├── store.test.ts
│           ├── user.test.ts
│           ├── network.test.ts
│           ├── resource_monitor.test.ts
│           └── new_modules.test.ts
├── examples/               # 示例脚本
│   ├── demo.ts
│   ├── ssl_connect.ts
│   ├── docker_manager.ts
│   ├── event_logger.ts
│   ├── share.ts
│   ├── notify.ts
│   ├── iscsi_manager.ts
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
pnpm install
```

## 编译

```bash
pnpm build
```

## 运行测试

```bash
pnpm test
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

### 两步验证登录

`login()` 会把需要验证码的挑战标记为 `twofaRequired`；调用方再通过
`submitTwofaCode()` 提交六位验证码。若 `twofaSetupRequired` 为 `true`，账号需要先在
fnOS 中完成两步验证绑定，SDK 不会自动执行绑定流程。

```typescript
import { FnosClient } from 'fnos';

const client = new FnosClient();

try {
  await client.connect('nas.example.com:5666');
  let result = await client.login('alice', 'password');

  if (result.twofaRequired) {
    const code = process.env.FNOS_TWOFA_CODE;
    if (!code) throw new Error('缺少 FNOS_TWOFA_CODE');
    result = await client.submitTwofaCode(code, false);
  } else if (result.twofaSetupRequired) {
    throw new Error('该账号需要先绑定两步验证');
  }

  if (result.result !== 'succ') {
    throw new Error(result.msg ?? result.errmsg ?? '登录失败');
  }
} finally {
  client.close();
}
```

最终登录成功只要求响应中包含 `token` 和 `secret`，`longToken` 可以缺失。

### OAuth HTTP 客户端

自 **0.5.0** 起，SDK 支持 OAuth 授权和 HTTP 业务请求。

`FnosOAuthAdapter` 处理飞牛特有的授权 URL、换码和刷新参数；开源库
[`oauth4webapi`](https://github.com/panva/oauth4webapi) 提供 PKCE 和 Bearer 请求能力。
`FnosOAuthClient` 使用拿到的 token 调用 `/ogh/ac/w`，可直接传给 `User`、
`SystemInfo` 等现有业务模块。

完整的交互式流程见 [examples/oauth.ts](examples/oauth.ts)。运行后打开终端显示的
链接，在浏览器完成登录和授权，再将一次性授权码输入终端：

```bash
npm run example:oauth -- https://nas.example.com:5667

# HTTP 测试环境必须显式允许明文 HTTP
npm run example:oauth -- http://nas.example.com:5666 --allow-insecure-http

npm run example:oauth -- --help
```

示例完成授权后调用 `User.getInfo()`，成功时输出 `oauth: ok`、`api: succ` 和响应字段名。
授权码由终端交互读取，token 保留在进程内。

```typescript
import { createInterface } from 'node:readline/promises';
import { FnosOAuthAdapter, FnosOAuthClient, User } from 'fnos';

const adapter = new FnosOAuthAdapter({ endpoint: 'https://nas.example.com:5667' });
const pending = await adapter.createAuthorizationRequest();
console.log(pending.url); // 由用户在浏览器完成授权
const input = createInterface({ input: process.stdin, output: process.stdout });
let code: string;
try {
  code = await input.question('Authorization code: ');
} finally {
  input.close();
}
const session = await adapter.exchangeCode(code, pending);
const client = new FnosOAuthClient(adapter, session);
console.log(await new User(client).getInfo());
```

授权 URL 不包含 `redirect_uri`，通过用户手动输入授权码完成换码。
授权码和 PKCE verifier 只在本次交互中使用，授权码 5 分钟内有效。
`FnosOAuthClient` 在 access token 临期或 API 返回 401 时刷新 token，401 最多重试一次。
默认 session 只在内存中；如需跨进程保留，请自行安全保存 `session`，并通过
`saveSession` 回调保存刷新后的 session。重新加载 session 时要复用原来的 `deviceId`
和 `clientId`；设备 ID 可从 `adapter.deviceId` 读取，示例支持通过 `--device-id` 传入。
SDK 使用 HTTP 时须显式设置 `allowInsecureHttp: true`。默认 client ID 和 scopes 与
trim-cli 一致，可通过 `clientId`、`scopes` 配置。

#### 现有 API 的兼容范围

SDK 的 21 个业务类、111 个方法都通过 `FnosRequestClient.requestPayloadWithResponse()`
发送请求，因此构造业务类时可以传入 `FnosClient` 或 `FnosOAuthClient`，方法参数保持一致：

```typescript
const user = new User(client); // client 可以是任一种客户端
const info = await user.getInfo();
```

实际请求是否成功，还取决于 token 的 scope、账号权限和当前 fnOS OAuth 网关是否开放该端点。
SDK 接口兼容不等于全部端点已经通过真机验证。目前在 fnOS **1.2.0800** 上完成了
授权换码和 `user.info` 验证；单元测试检查了 71 个只读端点通过 OAuth HTTP 发送时的
请求参数与响应解包。其他端点的真机兼容性仍需逐项确认。

`connect()`、账号密码 `login()`、`loginViaToken()`、`onMessage()`、心跳和重连属于
`FnosClient` 的 WebSocket 连接能力；`FnosOAuthClient` 提供的是业务请求接口。

### SSL/WSS 连接

```typescript
import { FnosClient } from './src/index.js';

async function main() {
  const client = new FnosClient();

  // 方式一: 使用 wss:// 协议前缀（优先级最高）
  await client.connect('wss://nas-9.timandes.net:5667', 3000, true, true);

  // 方式二: 使用参数指定 SSL
  await client.connect('nas-9.timandes.net:5667', 3000, true, true);
  //                                                          useSsl  skipSslVerify

  // 登录
  const result = await client.login('admin', 'password');
  console.log('登录结果:', result);

  client.close();
}

main().catch(console.error);
```

### 诊断强制 HTTPS

当 `ws://` 握手被 fnOS 重定向到 `https://` 时，`connect()` 抛出
`HTTPSRequiredError`。SDK 不会自动切换 WSS 或重试；调用方应检查异常后自行决定是否用
`wss://` 或 `useSsl=true` 重新连接。

```typescript
import { FnosClient, HTTPSRequiredError } from 'fnos';

const client = new FnosClient();

try {
  await client.connect('nas.example.com:5666');
} catch (error) {
  if (!(error instanceof HTTPSRequiredError)) throw error;
  const suggested = new URL(error.redirectUri);
  suggested.protocol = 'wss:';
  console.log(error.statusCode, error.requestedUri, error.redirectUri);
  console.log(`建议改用: ${suggested}`);
} finally {
  client.close();
}
```

### 运行示例脚本

```bash
# 统一认证参数支持 --code、--trust-device、--use-ssl 和 --skip-ssl-verify
npm exec -- tsx examples/twofa_login.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/backup_manager.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/download_center.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/ip_blocker.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/license_manager.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/live_update.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/mount_manager.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/network_server.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/security.ts --user USER --password PASSWORD -e HOST:PORT
npm exec -- tsx examples/system_restore.ts --user USER --password PASSWORD -e HOST:PORT

# 只诊断强制 HTTPS，无需用户名和密码
npm exec -- tsx examples/https_required_error.ts -e HOST:PORT

# 磁盘温度诊断工具
npm run tool:disk-temperatures -- --user USER --password PASSWORD -e HOST:PORT
```

## API 参考

### FnosClient

| 方法名 | 简介 |
| ---- | ---- |
| `__init__` | 初始化客户端，支持 type 参数（"main"、"timer"或"file"，默认为"main"） |
| `connect` | 连接到 WebSocket 服务器（支持 SSL/WSS，参数：endpoint, timeout, useSsl, skipSslVerify） |
| `login` | 用户登录方法 |
| `submitTwofaCode` | 提交六位两步验证码，可选择信任当前设备 |
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
| `getUserStorage` | 获取用户存储信息 |

### DockerManager

| 方法名 | 简介 |
| ---- | ---- |
| `listComposes` | 获取 Docker Compose 项目列表 |
| `listContainers` | 获取容器列表 |
| `stats` | 获取容器统计信息 |
| `getSystemSettings` | 获取 Docker 系统设置 |

### EventLogger

| 方法名 | 简介 |
| ---- | ---- |
| `commonList` | 获取事件日志列表 |

### Share

| 方法名 | 简介 |
| ---- | ---- |
| `smbOpt` | 获取 SMB 共享配置信息 |

### Notify

| 方法名 | 简介 |
| ---- | ---- |
| `unreadTotal` | 获取未读通知总数 |

### IscsiManager

| 方法名 | 简介 |
| ---- | ---- |
| `getConfig` | 获取 iSCSI 配置 |
| `listInitiators` | 获取 iSCSI Initiator 列表 |
| `listLuns` | 获取 iSCSI LUN 列表 |
| `listLunUsergroups` | 获取 iSCSI LUN 用户组列表 |
| `listTargets` | 获取 iSCSI Target 列表 |

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
| `getAcl` | 获取文件的 ACL（访问控制列表）信息 |

### 扩展只读查询 API

下表列出本次从 pyfnos main 同步的 71 个只读查询端点。所有方法均原样返回 fnOS
响应，最后一个可选参数为 `timeout`；带参数的方法会在发起请求前校验参数。

| 类 | 新增方法 |
| --- | --- |
| `BackupManager` | `listTasks(direction)` |
| `DockerManager` | `listImageDownloads()`、`listImages()`、`listNetworks()`、`listRegistryRepositories(keyword, page, pageSize)` |
| `DownloadCenter` | `getDefaultSaveDirectory()`、`getStatistics()`、`queryTasks(stateFilter, initFlag)` |
| `File` | `listAppDirectories()`、`listFavorites()`、`listDirectoryEntries()`、`listRecent()`、`listShared()`、`listSharedByOthers()`、`listTeamTrashBins()`、`listTrash()` |
| `IPBlocker` | `listAllowedAddresses()`、`getAutoBlockRule()`、`listDeniedAddresses()` |
| `LicenseManager` | `list(page, pageSize)` |
| `LiveUpdate` | `getStatus()` |
| `MountManager` | `listMounts()`、`getSettings()` |
| `NetworkServer` | `listCertificates()`、`getConnectionConfig()`、`getConnectionStatus()`、`listDdnsProviders()`、`listDdnsRecords(page, pageSize)` |
| `Network` | `getGateway()`、`getMultiGatewayStatus()`、`getNicPerformanceMode()`、`getInfo(ifName)`、`getSshStatus()` |
| `ResourceMonitor` | `npu()`、`processes()`、`serviceProcesses()`、`systemFan()` |
| `SAC` | `getEmailConfig()`、`listEmailProviders()` |
| `Security` | `getFirewall()`、`getProcessTraffic(processes)` |
| `Share` | `dlnaOptions()`、`dlnaShareOptions()`、`ftpOptions()`、`ftpShareOptions()`、`nfsOptions()`、`nfsShareOptions()`、`smbShareOptions()`、`webdavOptions()`、`webdavShareOptions()`、`getLinkDefaults()`、`getDefaultLink()`、`listLinks(...)`、`getLinkPermission()` |
| `Store` | `getCacheDeviceState()`、`getDiskIdleTime()`、`getDiskWakeup()`、`getRemovableConfig()`、`listCacheDevices()`、`listRemovableDevices()` |
| `SystemInfo` | `getReservedPartition()` |
| `SystemRestore` | `getInfo()` |
| `User` | `listTokens()`、`getMyTwofaConfig()`、`getGlobalTwofaConfig()`、`getUserTwofaConfig(uid)`、`getActiveState()`、`getGroupInfo(group)`、`listGroups()`、`listLoginDevices()`、`getPreference(name)` |

新增领域类 `BackupManager`、`DownloadCenter`、`IPBlocker`、`LicenseManager`、
`LiveUpdate`、`MountManager`、`NetworkServer`、`Security` 和 `SystemRestore` 均从包入口导出。

### 磁盘温度诊断

`dist/tools/list_disk_temperatures.js`（npm 命令 `tool:disk-temperatures`）按以下顺序读取温度：

1. `ResourceMonitor.disk().data.disk[].temp`；
2. `Store.getDiskSmart().smart.temperature.current`；
3. `Store.getDiskSmart().smart.nvme_smart_health_information_log.temperature`。

缺失、非数字、非有限数值或 `0` 会触发下一层回退。单块磁盘 SMART 失败不会影响其他
磁盘；输出会标明最终来源和每个被跳过候选值的原因。工具支持与示例相同的 SSL 和 2FA
参数，并对错误详情中的密码、验证码及认证 token 脱敏。

### 暂不支持的响应样本

以下 7 个端点在上游只有响应 fixture，没有配套请求 fixture。本次同步没有猜测请求参数，
因此暂不公开：

- `appcgi.license.soft.get`
- `appcgi.license.soft.ipc.get`
- `appcgi.mountmgr.task.list`
- `appcgi.sac.entry.v1.getEntryList`
- `appcgi.sac.entry.v1.getUserDesktop`
- `taskState.list`
- `util.getSI`

## 加密实现

本项目使用 Node.js 内置的 `crypto` 模块实现了与 pyfnos 项目完全一致的加密功能：

- **RSA**: 使用 RSA-PKCS1-v1_5 填充进行公钥加密
- **AES**: 使用 AES-256-CBC 模式进行对称加密
- **HMAC**: 使用 HMAC-SHA256 进行消息认证

## 许可证

Apache License 2.0
