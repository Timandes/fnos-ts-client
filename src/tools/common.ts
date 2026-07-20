import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { FnosClient, type LoginResponse } from '../index.js';

export interface ToolArgs {
  user: string;
  password: string;
  endpoint: string;
  code?: string;
  trustDevice: boolean;
  useSsl: boolean;
  skipSslVerify: boolean;
  debug: boolean;
}

function value(argv: string[], long: string, short?: string): string | undefined {
  const index = argv.findIndex((item) => item === long || item === short);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseToolArgs(argv = process.argv.slice(2)): ToolArgs {
  const user = value(argv, '--user');
  const password = value(argv, '--password');
  if (!user || !password) throw new Error('--user 和 --password 为必填参数');
  return {
    user,
    password,
    endpoint: value(argv, '--endpoint', '-e') ?? 'your-custom-endpoint.com:5666',
    code: value(argv, '--code'),
    trustDevice: argv.includes('--trust-device'),
    useSsl: argv.includes('--use-ssl'),
    skipSslVerify: (value(argv, '--skip-ssl-verify') ?? 'true').toLowerCase() === 'true',
    debug: argv.includes('--debug'),
  };
}

export async function connectClient(client: FnosClient, args: ToolArgs): Promise<void> {
  await client.connect(args.endpoint, 3000, args.useSsl, args.skipSslVerify);
}

export async function loginWithTwofa(client: FnosClient, args: ToolArgs): Promise<LoginResponse> {
  let result = await client.login(args.user, args.password);
  if (result.twofaRequired) {
    let code = args.code;
    if (!code) {
      const readline = createInterface({ input: stdin, output: stdout });
      try {
        code = await readline.question('请输入 6 位两步验证码: ');
      } finally {
        readline.close();
      }
    }
    result = await client.submitTwofaCode(code, args.trustDevice);
  } else if (result.twofaSetupRequired) {
    throw new Error('该账号需要先绑定两步验证后才能继续登录');
  }
  if (result.result !== 'succ') throw new Error(result.msg ?? result.errmsg ?? '登录失败');
  return result;
}
