// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { FnosClient } from './client.js';
import {
  requireNonEmptyString,
  requireNonNegativeInteger,
} from './validation.js';

/**
 * 用户类
 */
export class User {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 请求用户和组列表信息
   */
  async listUserGroups(timeout: number = 10000): Promise<any> {
    const payload = { users: true, groups: true };
    const response = await this.client.requestPayloadWithResponse('user.listUG', payload, timeout);
    return response;
  }

  /**
   * 请求用户分组信息
   */
  async groupUsers(timeout: number = 10000): Promise<any> {
    const payload = {};
    const response = await this.client.requestPayloadWithResponse('user.groupUsers', payload, timeout);
    return response;
  }

  /**
   * 获取用户信息
   */
  async getInfo(timeout: number = 10000): Promise<any> {
    const payload = {};
    const response = await this.client.requestPayloadWithResponse('user.info', payload, timeout);
    return response;
  }

  /**
   * 检查当前用户是否为管理员
   */
  async isAdmin(timeout: number = 10000): Promise<any> {
    const payload = {};
    const response = await this.client.requestPayloadWithResponse('user.isAdmin', payload, timeout);
    return response;
  }

  async listTokens(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.accountsrv.v1.token.list',
      { data: {} },
      timeout,
    );
  }

  async getMyTwofaConfig(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.tfa.security.v1.me.getConfig',
      {},
      timeout,
    );
  }

  async getGlobalTwofaConfig(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.tfa.security.v1.twofa.getConfig',
      {},
      timeout,
    );
  }

  async getUserTwofaConfig(uid: number, timeout: number = 10000): Promise<any> {
    requireNonNegativeInteger('uid', uid);
    return this.client.requestPayloadWithResponse(
      'appcgi.tfa.security.v1.user.getTwofaConfig',
      { data: { uid } },
      timeout,
    );
  }

  async getActiveState(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse('user.active', {}, timeout);
  }

  async getGroupInfo(group: string, timeout: number = 10000): Promise<any> {
    requireNonEmptyString('group', group);
    return this.client.requestPayloadWithResponse(
      'user.groupInfo',
      { group },
      timeout,
    );
  }

  async listGroups(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse('user.groupList', {}, timeout);
  }

  async listLoginDevices(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'user.listLoginDevice',
      {},
      timeout,
    );
  }

  async getPreference(name: string, timeout: number = 10000): Promise<any> {
    requireNonEmptyString('name', name);
    return this.client.requestPayloadWithResponse(
      'usrdat.get',
      { name },
      timeout,
    );
  }
}
