import { LiveUpdate } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('在线更新状态查询', async (client) => {
  console.log('status', await new LiveUpdate(client).getStatus());
}).catch((error) => { console.error(error); process.exitCode = 1; });
