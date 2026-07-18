import { BackupManager } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('备份任务查询', async (client) => {
  const api = new BackupManager(client);
  console.log('outbound', await api.listTasks(0));
  console.log('inbound', await api.listTasks(1));
}).catch((error) => { console.error(error); process.exitCode = 1; });
