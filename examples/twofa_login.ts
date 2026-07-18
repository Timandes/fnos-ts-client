import { runAuthenticatedExample } from './common.js';

runAuthenticatedExample('两步验证登录示例', async (client) => {
  console.log('登录成功:', client.isConnected());
}).catch((error) => { console.error(error); process.exitCode = 1; });
