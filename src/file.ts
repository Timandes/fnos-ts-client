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

interface FileDetails {
  name?: string;
  count?: number;
  dir?: boolean;
}

/**
 * 文件类
 */
export class File {
  private client: FnosClient;

  constructor(client: FnosClient) {
    this.client = client;
  }

  /**
   * 列出指定目录下的文件和文件夹
   */
  async list(path: string | null = null, timeout: number = 10000): Promise<any> {
    const payload: { path?: string } = {};
    if (path !== null) {
      payload.path = path;
    }
    const response = await this.client.requestPayloadWithResponse('file.ls', payload, timeout);
    return response;
  }

  /**
   * 创建文件夹
   */
  async mkdir(path: string, timeout: number = 10000): Promise<any> {
    if (!path) {
      throw new Error('path参数不能为空');
    }
    const payload = { path: path };
    const response = await this.client.requestPayloadWithResponse('file.mkdir', payload, timeout);
    return response;
  }

  /**
   * 删除文件或文件夹
   */
  async remove(
    files: string[],
    moveToTrashbin: boolean = true,
    details: FileDetails | null = null,
    timeout: number = 10000
  ): Promise<any> {
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('files参数必须是非空列表');
    }
    const payload: any = {
      files: files,
      moveToTrashbin: moveToTrashbin,
    };
    if (details !== null) {
      payload.details = details;
    }
    const response = await this.client.requestPayloadWithResponse('file.rm', payload, timeout);
    return response;
  }
}