import { NetworkServer } from '../src/index.js';
import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('网络服务查询', async (client) => {
  const api = new NetworkServer(client);
  console.log('certificates', await api.listCertificates());
  console.log('connectionConfig', await api.getConnectionConfig());
  console.log('connectionStatus', await api.getConnectionStatus());
  console.log('ddnsProviders', await api.listDdnsProviders());
  console.log('ddnsRecords', await api.listDdnsRecords());
}).catch((error) => { console.error(error); process.exitCode = 1; });
