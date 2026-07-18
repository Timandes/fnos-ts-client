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

import { FnosClient } from './client.js';
import { requirePositiveInteger } from './validation.js';

/**
 * Docker 管理类
 */
export class DockerManager {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 获取 Docker Compose 项目列表
   */
  async listComposes(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.dockermgr.composeList', {}, timeout);
    return response;
  }

  /**
   * 获取容器列表
   * @param all 是否返回所有容器（包括停止的），默认为 true
   */
  async listContainers(all: boolean = true, timeout: number = 10000): Promise<any> {
    const payload = { all: all };
    const response = await this.client.requestPayloadWithResponse('appcgi.dockermgr.containerList', payload, timeout);
    return response;
  }

  /**
   * 获取容器统计信息
   */
  async stats(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.dockermgr.stats', {}, timeout);
    return response;
  }

  /**
   * 获取 Docker 系统设置
   */
  async getSystemSettings(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.dockermgr.systemSettingGet', {}, timeout);
    return response;
  }

  async listImageDownloads(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.dockermgr.imageDownloadList',
      {},
      timeout,
    );
  }

  async listImages(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.dockermgr.imageList',
      {},
      timeout,
    );
  }

  async listNetworks(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.dockermgr.networkList',
      {},
      timeout,
    );
  }

  async listRegistryRepositories(
    keyword: string = '',
    page: number = 1,
    pageSize: number = 20,
    timeout: number = 10000,
  ): Promise<any> {
    requirePositiveInteger('page', page);
    requirePositiveInteger('pageSize', pageSize);
    return this.client.requestPayloadWithResponse(
      'appcgi.dockermgr.registryHubRepoList',
      { key: keyword, page, pageSize },
      timeout,
    );
  }
}
