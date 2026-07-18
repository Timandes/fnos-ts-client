import { IPBlocker } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('IP 阻止规则查询', async (client) => {
  const api = new IPBlocker(client);
  console.log('allowed', await api.listAllowedAddresses());
  console.log('autoBlock', await api.getAutoBlockRule());
  console.log('denied', await api.listDeniedAddresses());
}).catch((error) => { console.error(error); process.exitCode = 1; });
