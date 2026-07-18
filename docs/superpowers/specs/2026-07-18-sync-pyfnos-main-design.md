# 同步 pyfnos main 设计

## 背景与基线

当前 TypeScript SDK `fnos@0.3.0` 对应 pyfnos `v0.12.0`。本次同步固定以上游
pyfnos `main` 提交 `11d5b9e`（2026-07-15）为来源基线，不在实现过程中追随新的
上游提交，以保证范围可复核。

上游 `v0.12.0..11d5b9e` 的可移植能力包括：

- pyfnos `v0.13.0` 的两步验证登录；
- 71 个有完整脱敏请求样本的只读查询端点，共 82 种请求组合；
- 9 个新领域类，以及 9 个现有领域类的扩展；
- fnOS 强制 HTTPS 时的专用连接异常；
- 统一的示例认证流程；
- 磁盘温度诊断工具及其监控、SMART、NVMe SMART 回退链。

## 目标

- 在不破坏现有 TypeScript 调用方式的前提下，对齐上述用户可见能力。
- 保留 fnOS 协议中的端点名、字段名、嵌套结构、默认值和响应原貌。
- 公共 API 遵循项目已有的 camelCase 命名风格。
- 用离线契约测试覆盖全部请求形状，用集成测试覆盖真实 WebSocket 流程。
- 示例、README、导出和 Changelog 与新增 API 保持一致。

## 非目标

- 不移植 Python 构建配置、依赖锁、内部工作计划或 Python 专用实现细节。
- 不新增写入、删除、启动、停止或配置修改端点。
- 不为只有响应 fixture、没有请求 fixture 的端点猜测参数。
- 不引入响应模型、缓存、透明重试、运行时代码生成或新的生产依赖。
- 检测到强制 HTTPS 时不自动切换 WSS，也不自动重试。
- 本次同步不发布 npm 包、不创建 tag，也不修改 `package.json` 和 `src/index.ts`
  中的 `0.3.0` 版本；变更记录进入 `Unreleased`。

## 总体架构

实现分为四个互相独立的边界：

1. `FnosClient` 负责连接、认证状态机、加密和响应路由。
2. 领域类负责参数校验、精确构造请求 payload，并原样返回服务端响应。
3. `examples/` 和 `tools/` 负责命令行编排，不向 SDK 核心反向增加 CLI 依赖。
4. 测试层以离线协议契约为主，以 fnos-mock-server 集成为补充。

所有领域方法继续调用
`FnosClient.requestPayloadWithResponse(endpoint, payload, timeout)`。客户端仍统一添加
`req` 和 `reqid`；领域类不得自行添加这两个字段。

## 两步验证登录

### 公共 API

扩展现有登录方法，新增参数全部位于现有参数之后，因此旧调用保持有效：

```ts
login(
  username: string,
  password: string,
  timeout?: number,
  stay?: boolean,
  deviceType?: string,
  deviceName?: string,
): Promise<LoginResponse>
```

默认值依次为 `10000`、`true`、`Browser` 和 `Mac OS-Safari`。

新增方法：

```ts
submitTwofaCode(
  code: string,
  trustDevice?: boolean,
  timeout?: number,
): Promise<LoginResponse>
```

`trustDevice` 默认为 `false`。`LoginResponse` 增加可选的
`accessToken`、`twofaRequired`、`twofaSetupRequired`、`secureEmail` 及相关服务端字段，
并继续兼容现有 `token`、`longToken`、`secret` 和错误字段。

### 状态判定

- `result === "succ"` 且同时包含 `token` 和 `secret`：最终登录成功；
  `longToken` 可缺失。
- `isBindTwofaSecret === true`、`isTrustedDevice === false`、存在
  `accessToken`，且没有 `token`/`secret`：返回
  `twofaRequired: true`、`twofaSetupRequired: false`。
- `isTwofaEnforced === true`、`isBindTwofaSecret === false`、存在
  `accessToken`，且没有 `token`/`secret`：返回
  `twofaRequired: false`、`twofaSetupRequired: true`，但不自动执行 TOTP 绑定。

客户端保存挑战所需的 `accessToken`、`stay`、`deviceType` 和 `deviceName`。
`submitTwofaCode()` 仅接受六位数字，使用新的 `reqid`，构造并加密：

```json
{
  "req": "user.2fa.loginVerify",
  "code": "583213",
  "isTrustedDevice": false,
  "accessToken": "<challenge-token>",
  "stay": 1,
  "deviceName": "Mac OS-Safari",
  "deviceType": "Browser",
  "did": "<generated-device-id>",
  "reqid": "<generated-request-id>",
  "si": "<session-id>"
}
```

最终成功时保存 token、可选 longToken 和解密后的 secret，并清理临时 2FA 状态。
服务端明确返回的 2FA 失败响应原样返回；未连接、缺少挑战、验证码格式错误和超时抛出
SDK 错误。

## 强制 HTTPS 异常

新增公共异常：

```ts
class HTTPSRequiredError extends Error {
  readonly requestedUri: string;
  readonly redirectUri: string;
  readonly statusCode: number;
}
```

`FnosClient.connect()` 监听 `ws` 的 HTTP 握手失败边界。仅当以下条件全部成立时转换为
`HTTPSRequiredError`：

1. 当前实际使用 `ws://`；
2. HTTP 状态码是 `301`、`302`、`303`、`307` 或 `308`；
3. 存在 `Location`，并可相对当前 WebSocket URI解析；
4. 解析后的目标 scheme 是 `https:`。

异常保存完整原始 WS URI、解析后的 HTTPS URI和状态码，消息提示调用方改用
`wss://` 或 `useSsl=true`。其他握手、TLS、URI和网络错误保持普通连接错误，不误报为
强制 HTTPS。连接只尝试一次。

## 查询 API

### 新增领域类

- `BackupManager`
- `DownloadCenter`
- `IPBlocker`
- `LicenseManager`
- `LiveUpdate`
- `MountManager`
- `NetworkServer`
- `Security`
- `SystemRestore`

这些类与现有领域类一致：构造函数接受 `FnosClient`，所有方法返回原始响应，并从
`src/index.ts` 导出。

### 端点清单

以下 71 个公共方法按 TypeScript 命名映射到上游确认的 fnOS 请求：

| 类 | 方法 | 请求端点 |
| --- | --- | --- |
| `BackupManager` | `listTasks(direction)` | `appcgi.backup.task.list` |
| `DockerManager` | `listImageDownloads()` | `appcgi.dockermgr.imageDownloadList` |
| `DockerManager` | `listImages()` | `appcgi.dockermgr.imageList` |
| `DockerManager` | `listNetworks()` | `appcgi.dockermgr.networkList` |
| `DockerManager` | `listRegistryRepositories(keyword, page, pageSize)` | `appcgi.dockermgr.registryHubRepoList` |
| `DownloadCenter` | `getDefaultSaveDirectory()` | `appcgi.downloadcenter.config.getDefaultSaveDir` |
| `DownloadCenter` | `getStatistics()` | `appcgi.downloadcenter.stat.all` |
| `DownloadCenter` | `queryTasks(stateFilter, initFlag)` | `appcgi.downloadcenter.task.query` |
| `File` | `listAppDirectories()` | `appcgi.filestor.getAppDirList` |
| `File` | `listFavorites()` | `file.fav.list` |
| `File` | `listDirectoryEntries()` | `file.lsDir` |
| `File` | `listRecent()` | `file.recent.list` |
| `File` | `listShared()` | `file.share.list` |
| `File` | `listSharedByOthers()` | `file.share.listOthers` |
| `File` | `listTeamTrashBins()` | `file.team.trash.listTrashbin` |
| `File` | `listTrash()` | `file.trash.list` |
| `IPBlocker` | `listAllowedAddresses()` | `appcgi.ipblocker.queryAllowList` |
| `IPBlocker` | `getAutoBlockRule()` | `appcgi.ipblocker.queryAutoBlockRule` |
| `IPBlocker` | `listDeniedAddresses()` | `appcgi.ipblocker.queryDenyList` |
| `LicenseManager` | `list(page, pageSize)` | `appcgi.license.soft.list` |
| `LiveUpdate` | `getStatus()` | `liveupdate.status` |
| `MountManager` | `listMounts()` | `appcgi.mountmgr.list` |
| `MountManager` | `getSettings()` | `appcgi.mountmgr.setting.detail` |
| `NetworkServer` | `listCertificates()` | `appcgi.netsvr.cert.list` |
| `NetworkServer` | `getConnectionConfig()` | `appcgi.netsvr.conn.getconfig` |
| `NetworkServer` | `getConnectionStatus()` | `appcgi.netsvr.conn.status` |
| `NetworkServer` | `listDdnsProviders()` | `appcgi.netsvr.ddns.provider.list` |
| `NetworkServer` | `listDdnsRecords(page, pageSize)` | `appcgi.netsvr.ddns.record.list` |
| `Network` | `getGateway()` | `appcgi.network.gw.getting` |
| `Network` | `getMultiGatewayStatus()` | `appcgi.network.net.getMultiGWStatus` |
| `Network` | `getNicPerformanceMode()` | `appcgi.network.net.getNicPerformanceMode` |
| `Network` | `getInfo(ifName)` | `appcgi.network.net.info` |
| `Network` | `getSshStatus()` | `appcgi.network.ssh.status` |
| `ResourceMonitor` | `npu()` | `appcgi.resmon.npu` |
| `ResourceMonitor` | `processes()` | `appcgi.resmon.proc.list` |
| `ResourceMonitor` | `serviceProcesses()` | `appcgi.resmon.proc.srv` |
| `ResourceMonitor` | `systemFan()` | `appcgi.resmon.sysFan` |
| `SAC` | `getEmailConfig()` | `appcgi.sac.externalnotify.v1.email.getConfig` |
| `SAC` | `listEmailProviders()` | `appcgi.sac.externalnotify.v1.email.getProviders` |
| `Security` | `getFirewall()` | `appcgi.security.firewall.getting` |
| `Security` | `getProcessTraffic(processes)` | `appcgi.security.flowaudit.traffic` |
| `Share` | `dlnaOptions()` | `appcgi.share.dlna.opt` |
| `Share` | `dlnaShareOptions()` | `appcgi.share.dlna.share.opt` |
| `Share` | `ftpOptions()` | `appcgi.share.ftp.opt` |
| `Share` | `ftpShareOptions()` | `appcgi.share.ftp.share.opt` |
| `Share` | `nfsOptions()` | `appcgi.share.nfs.opt` |
| `Share` | `nfsShareOptions()` | `appcgi.share.nfs.share.opt` |
| `Share` | `smbShareOptions()` | `appcgi.share.smb.share.opt` |
| `Share` | `webdavOptions()` | `appcgi.share.webdav.opt` |
| `Share` | `webdavShareOptions()` | `appcgi.share.webdav.share.opt` |
| `Share` | `getLinkDefaults()` | `appcgi.sharesvr.share.link.default.get` |
| `Share` | `getDefaultLink()` | `appcgi.sharesvr.share.link.default` |
| `Share` | `listLinks(isAdmin, keyword, page, pageSize, sortColumn, sortType)` | `appcgi.sharesvr.share.link.list` |
| `Share` | `getLinkPermission()` | `appcgi.sharesvr.share.permission.get` |
| `Store` | `getCacheDeviceState()` | `stor.cachedevState` |
| `Store` | `getDiskIdleTime()` | `stor.getDiskIdleTime` |
| `Store` | `getDiskWakeup()` | `stor.getDiskWakeup` |
| `Store` | `getRemovableConfig()` | `stor.getRemovableConf` |
| `Store` | `listCacheDevices()` | `stor.listCachedev` |
| `Store` | `listRemovableDevices()` | `stor.listRemovable` |
| `SystemInfo` | `getReservedPartition()` | `appcgi.sysinfo.getReservedPartition` |
| `SystemRestore` | `getInfo()` | `appcgi.sysrestore.getInfo` |
| `User` | `listTokens()` | `appcgi.accountsrv.v1.token.list` |
| `User` | `getMyTwofaConfig()` | `appcgi.tfa.security.v1.me.getConfig` |
| `User` | `getGlobalTwofaConfig()` | `appcgi.tfa.security.v1.twofa.getConfig` |
| `User` | `getUserTwofaConfig(uid)` | `appcgi.tfa.security.v1.user.getTwofaConfig` |
| `User` | `getActiveState()` | `user.active` |
| `User` | `getGroupInfo(group)` | `user.groupInfo` |
| `User` | `listGroups()` | `user.groupList` |
| `User` | `listLoginDevices()` | `user.listLoginDevice` |
| `User` | `getPreference(name)` | `usrdat.get` |

### 请求结构与默认值

- 所有方法最后一个参数均为 `timeout = 10000`。
- `User.listTokens()` 发送 `{ data: {} }`。
- `BackupManager.listTasks()` 发送顶层 `direction`，只接受整数 `0` 或 `1`。
- Docker 仓库查询将 `keyword` 映射为顶层 `key`；`page` 默认 `1`，`pageSize`
  默认 `20`。
- 下载任务查询发送顶层 `state_filter` 和 `init_flag`，默认 `65535` 和 `true`。
- License 与 DDNS 分页字段位于 `data` 内，默认 `page=1`、`pageSize=200`。
- `Network.getInfo()` 将 `ifName` 作为顶层字段。
- 进程流量查询将调用方传入的对象数组复制后放到顶层 `data`，不得修改调用方输入。
- 分享链接查询把全部筛选、分页和排序字段放在 `data` 内；默认值为
  `isAdmin=false`、`keyword=""`、`page=1`、`pageSize=100`、
  `sortColumn="createdTime"`、`sortType="DESC"`。
- 用户 2FA 配置查询把 `uid` 放在 `data` 内；组名和偏好名使用顶层字段。
- 其他方法发送空 payload。

### 参数校验

新增私有校验辅助函数，覆盖：非空字符串、正整数、非负整数和对象数组复制。

- `ifName`、用户组名和偏好名不能为空或仅包含空白。
- page 与 pageSize 必须是正整数。
- uid 必须是非负整数。
- direction 必须严格为数值 `0` 或 `1`，布尔值无效。
- processes 必须是普通对象数组，并复制数组和每个元素。

校验失败时在发送请求前抛出 `TypeError` 或 `RangeError`。服务端返回的
`result: "fail"` 仍原样返回，不在领域层翻译。

## 示例与诊断工具

新增 `examples/common.ts` 统一 endpoint、SSL、用户名密码和可选 2FA 的认证流程。
新增 9 个领域示例，并扩展对应现有领域示例。所有示例在 `finally` 中关闭客户端，且
`--help` 不发起网络连接。

新增 `examples/twofa_login.ts` 和 `examples/https_required_error.ts`。后者只诊断连接，
显示状态码、原始 WS URI、HTTPS 重定向 URI和建议的 WSS URI，明确说明没有自动重试。

新增 `tools/list_disk_temperatures.ts` 及工具专用认证辅助模块。磁盘温度顺序为：

1. `ResourceMonitor.disk().data.disk[].temp`；
2. `Store.getDiskSmart().smart.temperature.current`；
3. `Store.getDiskSmart().smart.nvme_smart_health_information_log.temperature`。

缺失、零值、布尔值、非数字、`NaN` 和无穷值均触发下一层回退并记录原因。单盘 SMART
失败不影响其他磁盘；成功枚举磁盘后，即使部分温度未知，工具也返回退出码 `0`。
顶层错误按连接、登录/2FA、温度收集三个阶段输出。默认输出错误类型和详情，`--debug`
输出经过脱敏的堆栈；密码、验证码、token、longToken、accessToken 和 secret 不得泄露。

工具使用 Node 内置参数解析和终端输入能力，不新增生产依赖。CLI 源码不作为 SDK 顶层
公共 API 导出。

## 测试策略

所有行为变更遵循 RED-GREEN-REFACTOR：先添加失败测试并确认失败原因，再写最小实现。

### 离线单元与契约测试

- 2FA：挑战分类、可选 longToken、验证码校验、加密 payload、成功/失败路由、状态清理、
  超时清理。
- HTTPS：用本地临时 HTTP 服务返回真实 3xx，验证专用异常、结构化字段、只连接一次，
  并覆盖非 HTTPS、非重定向、WSS 等负向场景。
- 查询 API：建立数据驱动矩阵，覆盖 71 个方法、82 种请求组合，验证精确端点、payload、
  默认参数、自定义参数、timeout 传递和响应原样返回。
- 参数校验：覆盖所有无效边界，并确认没有发起请求。
- 诊断工具：覆盖三级温度来源、逐盘回退、部分失败、顺序、退出码、2FA、错误阶段、
  debug 堆栈和敏感值脱敏。
- 示例：逐个运行 `--help`，验证导入、参数解析和无网络副作用。

### 集成验证

fnos-mock-server 使用包含对应请求 fixtures 的提交作为固定基线。集成测试覆盖：

- 普通登录和两步验证登录；
- 每个新增领域的查询方法；
- 新增端点没有 unknown request、超时或 payload 不匹配。

本地完成 `npm run build`、单元测试、工具测试和集成测试；CI 使用相同 mock-server 基线。

## 文档与版本

- `src/index.ts` 导出 9 个新类和 `HTTPSRequiredError`。
- README 增加 2FA、HTTPS 异常、查询 API、示例和磁盘温度工具说明。
- Changelog 增加 `Unreleased`，记录核心功能、端点扩展和诊断工具。
- npm 版本保持 `0.3.0`；发布版本另行决定。

## 延后端点

以下 7 个响应只有 response fixture，没有配套请求 fixture，本次不公开：

- `appcgi.license.soft.get`
- `appcgi.license.soft.ipc.get`
- `appcgi.mountmgr.task.list`
- `appcgi.sac.entry.v1.getEntryList`
- `appcgi.sac.entry.v1.getUserDesktop`
- `taskState.list`
- `util.getSI`

## 完成标准

1. 2FA 普通、挑战、提交和强制绑定状态均符合本设计，旧登录调用保持有效。
2. 强制 HTTPS 场景可被精确捕获，其他连接错误不被误分类。
3. 71 个端点全部具有明确公共方法，82 种请求组合全部由测试覆盖。
4. 9 个新领域类均可从包入口导入。
5. 参数校验、timeout 和原始响应语义保持一致。
6. 新增或扩展的示例通过无网络 `--help` 检查。
7. 磁盘温度工具通过回退、容错和脱敏测试。
8. 构建、离线测试和固定 mock-server 集成测试全部通过。
9. README、Changelog、导出和代码实现一致，且没有实现 7 个延后端点。
