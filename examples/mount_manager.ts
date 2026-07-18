import { MountManager } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('挂载查询', async (client) => {
  const api = new MountManager(client);
  console.log('mounts', await api.listMounts());
  console.log('settings', await api.getSettings());
}).catch((error) => { console.error(error); process.exitCode = 1; });
