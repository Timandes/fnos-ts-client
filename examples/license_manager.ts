import { LicenseManager } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('软件许可查询', async (client) => {
  console.log('licenses', await new LicenseManager(client).list());
}).catch((error) => { console.error(error); process.exitCode = 1; });
