import { FnosClient, HTTPSRequiredError } from '../src/index.js';

async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.includes('--help')) {
    console.log('Usage: tsx examples/https_required_error.ts -e HOST:PORT');
    return 0;
  }
  const index = argv.findIndex((item) => item === '-e' || item === '--endpoint');
  if (index < 0 || !argv[index + 1]) throw new Error('-e/--endpoint 为必填参数');
  const client = new FnosClient();
  try {
    await client.connect(argv[index + 1]);
    console.log('未检测到强制 HTTPS 重定向');
    return 0;
  } catch (error) {
    if (!(error instanceof HTTPSRequiredError)) throw error;
    const suggested = new URL(error.redirectUri);
    suggested.protocol = 'wss:';
    console.log(`状态码: ${error.statusCode}`);
    console.log(`原始请求: ${error.requestedUri}`);
    console.log(`重定向: ${error.redirectUri}`);
    console.log(`建议 WSS: ${suggested}`);
    console.log('SDK 未自动重试');
    return 0;
  } finally {
    client.close();
  }
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error); process.exitCode = 1;
});
