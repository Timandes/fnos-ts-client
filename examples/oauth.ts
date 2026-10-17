import { createInterface } from 'node:readline/promises';
import { FnosOAuthAdapter, FnosOAuthClient, User } from '../src/index.js';

async function main(): Promise<void> {
  const rawEndpoint = process.argv[2];
  if (!rawEndpoint) {
    console.error('Usage: npm run example:oauth -- <https://nas-host:port>');
    process.exitCode = 2;
    return;
  }
  const endpoint = new URL(rawEndpoint);
  const adapter = new FnosOAuthAdapter({
    endpoint: endpoint.origin,
    allowInsecureHttp: endpoint.protocol === 'http:',
  });
  const pending = await adapter.createAuthorizationRequest();
  console.log(`Open this URL in a browser:\n${pending.url}`);
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let code: string;
  try {
    code = await input.question('Authorization code: ');
  } finally {
    input.close();
  }
  const session = await adapter.exchangeCode(code, pending);
  const client = new FnosOAuthClient(adapter, session);
  const response = await new User(client).getInfo();
  console.log(JSON.stringify({ oauth: 'ok', api: response.result, responseKeys: Object.keys(response).sort() }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'OAuth validation failed');
  process.exitCode = 1;
});
