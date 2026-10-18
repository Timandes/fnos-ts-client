# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-10-18

### Added

- 新增 `FnosOAuthAdapter`，处理 fnOS 特有的 PKCE 授权 URL、授权码换 token 和 token 刷新。
- 新增 `FnosOAuthClient`，通过 Bearer token 调用 `/ogh/ac/w`，支持临期刷新、HTTP 401 后刷新并重试一次，以及单元素响应数组解包。
- 引入开源 `oauth4webapi`，提供 PKCE 和 Bearer 请求能力。
- 新增交互式 OAuth 示例 `examples/oauth.ts` 和 `npm run example:oauth`，支持帮助信息、显式允许 HTTP 测试和指定设备 ID。

### Changed

- 21 个业务类改用共享的 `FnosRequestClient` 接口，111 个现有方法可接收 WebSocket 或 OAuth 客户端；服务端可用范围仍受 scope、账号权限和网关支持限制。
- README 补充 OAuth 授权流程、业务模块复用方式、session 保存要求及验证范围。

## [0.4.0] - 2026-07-20

### Added

- 新增两步验证登录流程与 `submitTwofaCode()`。
- 新增 `HTTPSRequiredError`，识别 fnOS 强制 HTTPS 重定向。
- 新增 9 个领域类，并扩展 9 个现有领域类，覆盖 71 个只读查询端点。
- 新增磁盘温度诊断工具，支持资源监控、SMART 和 NVMe SMART 回退。

### Changed

- 最终登录成功不再依赖可选的 `longToken`。
- 集成测试固定使用 fnos-mock-server `d9592a05a8e07082b954921acfae3a9a915f3c01`。

## [0.3.0] - 2026-04-04

### Added
- 新增 `IscsiManager` 类，支持管理 iSCSI 配置和资源
  - `getConfig()`: 获取 iSCSI 配置信息
  - `listInitiators()`: 获取 Initiator 列表
  - `listLuns()`: 获取 LUN 列表
  - `listLunUsergroups(lunName, wwn)`: 获取 LUN 用户组列表
  - `listTargets()`: 获取 Target 列表
- `FnosClient.connect()` 新增 SSL/WSS 连接支持
  - `useSsl` 参数：是否使用 WSS 协议连接（默认 false）
  - `skipSslVerify` 参数：是否跳过 SSL 证书验证（默认 true，便于自签名证书场景）
  - 支持 endpoint 带协议前缀（`wss://` 或 `ws://`），前缀优先于 `useSsl` 参数
- 新增 `DockerManager` 类，支持管理 Docker 容器和项目
  - `listComposes()`: 获取 Docker Compose 项目列表
  - `listContainers(all=true)`: 获取容器列表
  - `stats()`: 获取容器统计信息
  - `getSystemSettings()`: 获取 Docker 系统设置
- 新增 `EventLogger` 类，支持获取事件日志
  - `commonList()`: 获取事件日志列表
- 新增 `Share` 类，支持获取共享配置信息
  - `smbOpt()`: 获取 SMB 共享配置信息
- 新增 `Notify` 类，支持获取通知信息
  - `unreadTotal()`: 获取未读通知总数
- 新增 `IscsiManager` 类，支持管理 iSCSI 配置
  - `getConfig()`: 获取 iSCSI 配置
  - `listInitiators()`: 获取 iSCSI Initiator 列表
  - `listLuns()`: 获取 iSCSI LUN 列表
  - `listLunUsergroups()`: 获取 iSCSI LUN 用户组列表
  - `listTargets()`: 获取 iSCSI Target 列表
- 扩展 `File` 类，新增方法
  - `getAcl(files)`: 获取文件的 ACL（访问控制列表）信息
- 扩展 `Store` 类，新增方法
  - `getUserStorage(spaceInfo, storInfo, quotaInfo)`: 获取用户存储信息
- 新增示例脚本
  - `ssl_connect.ts`: SSL/WSS 连接示例
  - `docker_manager.ts`: Docker 管理示例
  - `event_logger.ts`: 事件日志示例
  - `share.ts`: SMB 共享配置示例
  - `notify.ts`: 通知信息示例
  - `iscsi_manager.ts`: iSCSI 管理示例
- 集成测试重构
  - 将原 mock-based 测试移至单元测试 (`test/unit/client.test.ts`)
  - 新增真实集成测试，连接 fnos-mock-server 覆盖所有模块

## [0.2.1] - 2026-02-15

### Fixed
- 修复连接超时定时器未清除导致连接在 3 秒后被主动关闭的问题
- 修复心跳机制延迟启动的问题，现在会在启动时立即发送第一个心跳包
- 改进 `isConnected()` 方法，检查 WebSocket 实际状态确保准确性
- 修复调用 `client.close()` 方法时程序卡住无法退出的问题
- 修复 `login()` 和 `requestPayloadWithResponse()` 方法中超时定时器未清除导致程序延迟退出的问题

## [0.2.0] - 2026-01-29

### Added
- 集成 winston 日志框架
- 改进 examples 的命令行参数解析，支持 Linux 标准格式
- 为所有 examples 添加用法说明

### Fixed
- 修复重连时心跳不启动的问题

## [0.1.0] - 2026-01-26

### Added
- 初始版本发布
- 实现核心 WebSocket 客户端功能
- 实现加密模块（RSA + AES + HMAC）
- 实现资源监控、存储、系统信息、用户、网络、文件等模块
