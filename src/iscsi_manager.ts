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

/**
 * iSCSI 管理类
 */
export class IscsiManager {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 获取 iSCSI 配置
   */
  async getConfig(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.iscsimgr.iscsi.config.get', {}, timeout);
    return response;
  }

  /**
   * 获取 iSCSI Initiator 列表
   */
  async listInitiators(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.iscsimgr.iscsi.initiator.list', {}, timeout);
    return response;
  }

  /**
   * 获取 iSCSI LUN 列表
   */
  async listLuns(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.iscsimgr.iscsi.lun.list', {}, timeout);
    return response;
  }

  /**
   * 获取 iSCSI LUN 用户组列表
   * @param lunName LUN 名称，默认为空字符串（查询所有）
   * @param wwn WWN，默认为空字符串（查询所有）
   */
  async listLunUsergroups(lunName: string = '', wwn: string = '', timeout: number = 10000): Promise<any> {
    const payload = { lunName: lunName, wwn: wwn };
    const response = await this.client.requestPayloadWithResponse('appcgi.iscsimgr.iscsi.lun.usergroup.list', payload, timeout);
    return response;
  }

  /**
   * 获取 iSCSI Target 列表
   */
  async listTargets(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.iscsimgr.iscsi.target.list', {}, timeout);
    return response;
  }
}
