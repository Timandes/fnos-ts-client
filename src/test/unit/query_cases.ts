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

import { DockerManager } from '../../docker_manager.js';
import { File } from '../../file.js';
import { Network } from '../../network.js';
import { ResourceMonitor } from '../../resource_monitor.js';
import { SAC } from '../../sac.js';
import { Share } from '../../share.js';
import { Store } from '../../store.js';
import { SystemInfo } from '../../system_info.js';
import { User } from '../../user.js';
import type { QueryCase } from './query_contract.js';

const q = (
  name: string,
  endpoint: string,
  payload: Record<string, unknown>,
  invoke: QueryCase['invoke'],
): QueryCase => ({ name, endpoint, payload, invoke });

export const EXISTING_QUERY_CASES: QueryCase[] = [
  q('docker-image-downloads', 'appcgi.dockermgr.imageDownloadList', {}, (c, t) => new DockerManager(c).listImageDownloads(t)),
  q('docker-images', 'appcgi.dockermgr.imageList', {}, (c, t) => new DockerManager(c).listImages(t)),
  q('docker-networks', 'appcgi.dockermgr.networkList', {}, (c, t) => new DockerManager(c).listNetworks(t)),
  q('docker-registry', 'appcgi.dockermgr.registryHubRepoList', { key: '', page: 1, pageSize: 20 }, (c, t) => new DockerManager(c).listRegistryRepositories(undefined, undefined, undefined, t)),

  q('network-gateway', 'appcgi.network.gw.getting', {}, (c, t) => new Network(c).getGateway(t)),
  q('network-multi-gateway', 'appcgi.network.net.getMultiGWStatus', {}, (c, t) => new Network(c).getMultiGatewayStatus(t)),
  q('network-nic-performance', 'appcgi.network.net.getNicPerformanceMode', {}, (c, t) => new Network(c).getNicPerformanceMode(t)),
  q('network-info', 'appcgi.network.net.info', { ifName: 'eth0' }, (c, t) => new Network(c).getInfo('eth0', t)),
  q('network-ssh', 'appcgi.network.ssh.status', {}, (c, t) => new Network(c).getSshStatus(t)),

  q('resmon-npu', 'appcgi.resmon.npu', {}, (c, t) => new ResourceMonitor(c).npu(t)),
  q('resmon-processes', 'appcgi.resmon.proc.list', {}, (c, t) => new ResourceMonitor(c).processes(t)),
  q('resmon-service-processes', 'appcgi.resmon.proc.srv', {}, (c, t) => new ResourceMonitor(c).serviceProcesses(t)),
  q('resmon-system-fan', 'appcgi.resmon.sysFan', {}, (c, t) => new ResourceMonitor(c).systemFan(t)),

  q('file-app-directories', 'appcgi.filestor.getAppDirList', {}, (c, t) => new File(c).listAppDirectories(t)),
  q('file-favorites', 'file.fav.list', {}, (c, t) => new File(c).listFavorites(t)),
  q('file-directory-entries', 'file.lsDir', {}, (c, t) => new File(c).listDirectoryEntries(t)),
  q('file-recent', 'file.recent.list', {}, (c, t) => new File(c).listRecent(t)),
  q('file-shared', 'file.share.list', {}, (c, t) => new File(c).listShared(t)),
  q('file-shared-by-others', 'file.share.listOthers', {}, (c, t) => new File(c).listSharedByOthers(t)),
  q('file-team-trash', 'file.team.trash.listTrashbin', {}, (c, t) => new File(c).listTeamTrashBins(t)),
  q('file-trash', 'file.trash.list', {}, (c, t) => new File(c).listTrash(t)),

  q('store-cache-state', 'stor.cachedevState', {}, (c, t) => new Store(c).getCacheDeviceState(t)),
  q('store-disk-idle', 'stor.getDiskIdleTime', {}, (c, t) => new Store(c).getDiskIdleTime(t)),
  q('store-disk-wakeup', 'stor.getDiskWakeup', {}, (c, t) => new Store(c).getDiskWakeup(t)),
  q('store-removable-config', 'stor.getRemovableConf', {}, (c, t) => new Store(c).getRemovableConfig(t)),
  q('store-cache-devices', 'stor.listCachedev', {}, (c, t) => new Store(c).listCacheDevices(t)),
  q('store-removable-devices', 'stor.listRemovable', {}, (c, t) => new Store(c).listRemovableDevices(t)),

  q('user-tokens', 'appcgi.accountsrv.v1.token.list', { data: {} }, (c, t) => new User(c).listTokens(t)),
  q('user-my-twofa', 'appcgi.tfa.security.v1.me.getConfig', {}, (c, t) => new User(c).getMyTwofaConfig(t)),
  q('user-global-twofa', 'appcgi.tfa.security.v1.twofa.getConfig', {}, (c, t) => new User(c).getGlobalTwofaConfig(t)),
  q('user-twofa', 'appcgi.tfa.security.v1.user.getTwofaConfig', { data: { uid: 1000 } }, (c, t) => new User(c).getUserTwofaConfig(1000, t)),
  q('user-active', 'user.active', {}, (c, t) => new User(c).getActiveState(t)),
  q('user-group-info', 'user.groupInfo', { group: 'group' }, (c, t) => new User(c).getGroupInfo('group', t)),
  q('user-groups', 'user.groupList', {}, (c, t) => new User(c).listGroups(t)),
  q('user-login-devices', 'user.listLoginDevice', {}, (c, t) => new User(c).listLoginDevices(t)),
  q('user-preference-namesake', 'usrdat.get', { name: 'browser.namesakeConf' }, (c, t) => new User(c).getPreference('browser.namesakeConf', t)),
  q('user-preference-date', 'usrdat.get', { name: 'date-format' }, (c, t) => new User(c).getPreference('date-format', t)),

  q('share-dlna', 'appcgi.share.dlna.opt', {}, (c, t) => new Share(c).dlnaOptions(t)),
  q('share-dlna-share', 'appcgi.share.dlna.share.opt', {}, (c, t) => new Share(c).dlnaShareOptions(t)),
  q('share-ftp', 'appcgi.share.ftp.opt', {}, (c, t) => new Share(c).ftpOptions(t)),
  q('share-ftp-share', 'appcgi.share.ftp.share.opt', {}, (c, t) => new Share(c).ftpShareOptions(t)),
  q('share-nfs', 'appcgi.share.nfs.opt', {}, (c, t) => new Share(c).nfsOptions(t)),
  q('share-nfs-share', 'appcgi.share.nfs.share.opt', {}, (c, t) => new Share(c).nfsShareOptions(t)),
  q('share-smb-share', 'appcgi.share.smb.share.opt', {}, (c, t) => new Share(c).smbShareOptions(t)),
  q('share-webdav', 'appcgi.share.webdav.opt', {}, (c, t) => new Share(c).webdavOptions(t)),
  q('share-webdav-share', 'appcgi.share.webdav.share.opt', {}, (c, t) => new Share(c).webdavShareOptions(t)),
  q('share-link-defaults', 'appcgi.sharesvr.share.link.default.get', {}, (c, t) => new Share(c).getLinkDefaults(t)),
  q('share-default-link', 'appcgi.sharesvr.share.link.default', {}, (c, t) => new Share(c).getDefaultLink(t)),
  q('share-links-user', 'appcgi.sharesvr.share.link.list', { data: { isAdmin: false, keyword: '', page: 1, pageSize: 100, sortColumn: 'createdTime', sortType: 'DESC' } }, (c, t) => new Share(c).listLinks(undefined, undefined, undefined, undefined, undefined, undefined, t)),
  q('share-links-admin', 'appcgi.sharesvr.share.link.list', { data: { isAdmin: true, keyword: '', page: 1, pageSize: 100, sortColumn: 'createdTime', sortType: 'DESC' } }, (c, t) => new Share(c).listLinks(true, '', 1, 100, 'createdTime', 'DESC', t)),
  q('share-link-permission', 'appcgi.sharesvr.share.permission.get', {}, (c, t) => new Share(c).getLinkPermission(t)),

  q('sac-email-config', 'appcgi.sac.externalnotify.v1.email.getConfig', {}, (c, t) => new SAC(c).getEmailConfig(t)),
  q('sac-email-providers', 'appcgi.sac.externalnotify.v1.email.getProviders', {}, (c, t) => new SAC(c).listEmailProviders(t)),
  q('system-reserved-partition', 'appcgi.sysinfo.getReservedPartition', {}, (c, t) => new SystemInfo(c).getReservedPartition(t)),
];

export const ALL_QUERY_CASES: QueryCase[] = [...EXISTING_QUERY_CASES];
