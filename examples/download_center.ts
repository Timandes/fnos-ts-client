import { DownloadCenter } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('下载中心查询', async (client) => {
  const api = new DownloadCenter(client);
  console.log('saveDirectory', await api.getDefaultSaveDirectory());
  console.log('statistics', await api.getStatistics());
  console.log('tasks', await api.queryTasks());
}).catch((error) => { console.error(error); process.exitCode = 1; });
