import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { FnosOAuthAdapter, FnosOAuthClient, User } from '../src/index.js';

const usage = `Usage: npm run example:oauth -- <endpoint> [options]

Options:
  --allow-insecure-http  Allow an HTTP endpoint for testing
  --device-id <id>       Reuse an OAuth device ID
  -h, --help            Show this help

Examples:
  npm run example:oauth -- https://nas.example.com:5667
  npm run example:oauth -- http://nas.example.com:5666 --allow-insecure-http`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      'allow-insecure-http': { type: 'boolean', default: false },
      'device-id': { type: 'string' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (positionals.length !== 1) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  const adapter = new FnosOAuthAdapter({
    endpoint: positionals[0],
    allowInsecureHttp: values['allow-insecure-http'],
    deviceId: values['device-id'],
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
  if (response.result !== 'succ') throw new Error('user.info failed after OAuth authorization');
  console.log(JSON.stringify({ oauth: 'ok', api: response.result, responseKeys: Object.keys(response).sort() }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'OAuth validation failed');
  process.exitCode = 1;
});
