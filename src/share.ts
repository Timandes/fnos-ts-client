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
 * 共享类
 */
export class Share {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 获取 SMB 共享配置信息
   */
  async smbOpt(timeout: number = 10000): Promise<any> {
    const response = await this.client.requestPayloadWithResponse('appcgi.share.smb.opt', {}, timeout);
    return response;
  }

  async dlnaOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse('appcgi.share.dlna.opt', {}, timeout);
  }

  async dlnaShareOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.share.dlna.share.opt',
      {},
      timeout,
    );
  }

  async ftpOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse('appcgi.share.ftp.opt', {}, timeout);
  }

  async ftpShareOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.share.ftp.share.opt',
      {},
      timeout,
    );
  }

  async nfsOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse('appcgi.share.nfs.opt', {}, timeout);
  }

  async nfsShareOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.share.nfs.share.opt',
      {},
      timeout,
    );
  }

  async smbShareOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.share.smb.share.opt',
      {},
      timeout,
    );
  }

  async webdavOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.share.webdav.opt',
      {},
      timeout,
    );
  }

  async webdavShareOptions(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.share.webdav.share.opt',
      {},
      timeout,
    );
  }

  async getLinkDefaults(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.sharesvr.share.link.default.get',
      {},
      timeout,
    );
  }

  async getDefaultLink(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.sharesvr.share.link.default',
      {},
      timeout,
    );
  }

  async listLinks(
    isAdmin: boolean = false,
    keyword: string = '',
    page: number = 1,
    pageSize: number = 100,
    sortColumn: string = 'createdTime',
    sortType: string = 'DESC',
    timeout: number = 10000,
  ): Promise<any> {
    requirePositiveInteger('page', page);
    requirePositiveInteger('pageSize', pageSize);
    const data = {
      isAdmin,
      keyword,
      page,
      pageSize,
      sortColumn,
      sortType,
    };
    return this.client.requestPayloadWithResponse(
      'appcgi.sharesvr.share.link.list',
      { data },
      timeout,
    );
  }

  async getLinkPermission(timeout: number = 10000): Promise<any> {
    return this.client.requestPayloadWithResponse(
      'appcgi.sharesvr.share.permission.get',
      {},
      timeout,
    );
  }
}
