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

/**
 * Fnos - A TypeScript client for Fnos WebSocket communication
 */

export { FnosClient } from './client.js';
export { NotConnectedError } from './exceptions.js';
export { Crypto } from './crypto.js';
export { ResourceMonitor } from './resource_monitor.js';
export { Store } from './store.js';
export { SAC } from './sac.js';
export { SystemInfo } from './system_info.js';
export { User } from './user.js';
export { Network } from './network.js';
export { File } from './file.js';

export type { ConnectionType, LoginResponse } from './client.js';

export const version = '0.10.0';