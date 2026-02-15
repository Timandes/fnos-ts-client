# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

