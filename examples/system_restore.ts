import { SystemRestore } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('系统恢复信息查询', async (client) => {
  console.log('restore', await new SystemRestore(client).getInfo());
}).catch((error) => { console.error(error); process.exitCode = 1; });
