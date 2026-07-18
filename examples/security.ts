import { Security } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('安全状态查询', async (client) => {
  const api = new Security(client);
  console.log('firewall', await api.getFirewall());
  console.log('traffic', await api.getProcessTraffic([{ pid: 1, process: 'example' }]));
}).catch((error) => { console.error(error); process.exitCode = 1; });
