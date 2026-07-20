import { FnosClient, ResourceMonitor, Store } from '../index.js';
import { connectClient, loginWithTwofa, parseToolArgs, type ToolArgs } from './common.js';

export const MONITOR_SOURCE = 'ResourceMonitor.disk().data.disk[].temp';
export const SMART_SOURCE = 'Store.getDiskSmart().smart.temperature.current';
export const NVME_SOURCE = 'Store.getDiskSmart().smart.nvme_smart_health_information_log.temperature';
const MISSING = Symbol('missing');

export interface DiskTemperature {
  name: string;
  temperature?: number;
  source?: string;
  skipped: string[];
}

interface StoreLike {
  listDisks(): Promise<unknown>;
  getDiskSmart(name: string): Promise<unknown>;
}

interface MonitorLike {
  disk(): Promise<unknown>;
}

function nested(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) return MISSING;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function temperatureProblem(value: unknown): string | undefined {
  if (value === MISSING) return '字段不存在';
  if (typeof value !== 'number') return '不是数字';
  if (!Number.isFinite(value)) return '不是有限数值';
  if (value === 0) return '值为 0';
  return undefined;
}

function tryTemperature(result: DiskTemperature, source: string, value: unknown): boolean {
  const problem = temperatureProblem(value);
  if (problem) {
    result.skipped.push(`${source}${value === MISSING ? '' : ` = ${String(value)}`}（${problem}）`);
    return false;
  }
  result.temperature = value as number;
  result.source = source;
  return true;
}

function diskNames(response: unknown): string[] {
  const disks = nested(response, 'disk');
  if (!Array.isArray(disks)) throw new TypeError('Store.listDisks() 响应缺少 disk 列表');
  return disks.map((disk) => {
    const name = nested(disk, 'name');
    if (typeof name !== 'string' || !name) throw new TypeError('Store.listDisks() 返回了无效磁盘名称');
    return name;
  });
}

export async function collectDiskTemperatures(
  store: StoreLike,
  monitor: MonitorLike,
): Promise<DiskTemperature[]> {
  const names = diskNames(await store.listDisks());
  let monitorValues = new Map<string, unknown>();
  let monitorProblem: string | undefined;
  try {
    const disks = nested(await monitor.disk(), 'data', 'disk');
    if (!Array.isArray(disks)) {
      monitorProblem = 'ResourceMonitor.disk().data.disk（字段不存在或不是列表）';
    } else {
      for (const disk of disks) {
        const name = nested(disk, 'name');
        if (typeof name === 'string' && !monitorValues.has(name)) {
          monitorValues.set(name, nested(disk, 'temp'));
        }
      }
    }
  } catch (error) {
    monitorProblem = `ResourceMonitor.disk()（接口调用失败: ${errorSummary(error)}）`;
  }

  const results: DiskTemperature[] = [];
  for (const name of names) {
    const result: DiskTemperature = { name, skipped: [] };
    if (monitorProblem) result.skipped.push(monitorProblem);
    else if (!monitorValues.has(name)) result.skipped.push('ResourceMonitor.disk()（未找到该磁盘）');
    else if (tryTemperature(result, MONITOR_SOURCE, monitorValues.get(name))) {
      results.push(result);
      continue;
    }

    let smart: unknown;
    try {
      smart = await store.getDiskSmart(name);
    } catch (error) {
      result.skipped.push(`Store.getDiskSmart(${JSON.stringify(name)})（接口调用失败: ${errorSummary(error)}）`);
      results.push(result);
      continue;
    }
    if (!tryTemperature(result, SMART_SOURCE, nested(smart, 'smart', 'temperature', 'current'))) {
      tryTemperature(result, NVME_SOURCE, nested(smart, 'smart', 'nvme_smart_health_information_log', 'temperature'));
    }
    results.push(result);
  }
  return results;
}

export function formatDiskTemperatures(results: DiskTemperature[]): string {
  return results.map((item) => {
    const heading = `${item.name} => ${item.temperature === undefined ? '未知' : `${item.temperature}°C`}`;
    return [
      heading,
      item.source ? `  来源: ${item.source}` : '',
      ...item.skipped.map((reason) => `  跳过: ${reason}`),
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

const AUTH_FIELD = /((?:accessToken|longToken|token|secret|password|code)\s*[:=]\s*)(["']?)[^,\s}\]]+\2/gi;

export function redact(text: string, sensitive: unknown[] = []): string {
  let result = text;
  for (const value of sensitive) {
    if (value !== undefined && String(value)) result = result.split(String(value)).join('***');
  }
  return result.replace(AUTH_FIELD, '$1***');
}

function errorSummary(error: unknown): string {
  const value = error instanceof Error ? error : new Error(String(error));
  return `${value.name}: ${value.message.trim() || '无详细信息'}`;
}

export interface ToolDependencies {
  createClient(): FnosClient;
  createStore(client: FnosClient): StoreLike;
  createMonitor(client: FnosClient): MonitorLike;
  log(message: string): void;
  error(message: string): void;
}

const DEFAULT_DEPENDENCIES: ToolDependencies = {
  createClient: () => new FnosClient(),
  createStore: (client) => new Store(client),
  createMonitor: (client) => new ResourceMonitor(client),
  log: console.log,
  error: console.error,
};

export async function run(
  args: ToolArgs,
  dependencies: ToolDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  const client = dependencies.createClient();
  let stage = '连接';
  try {
    await connectClient(client, args);
    stage = '登录或两步验证';
    await loginWithTwofa(client, args);
    stage = '磁盘枚举与温度获取';
    const result = await collectDiskTemperatures(
      dependencies.createStore(client), dependencies.createMonitor(client),
    );
    dependencies.log(formatDiskTemperatures(result));
    return 0;
  } catch (error) {
    const value = error instanceof Error ? error : new Error(String(error));
    const sensitive = [args.password, args.code];
    dependencies.error(`错误: ${stage}阶段失败`);
    dependencies.error(`异常类型: ${value.name}`);
    dependencies.error(`异常详情: ${redact(value.message || '无详细信息', sensitive)}`);
    if (args.debug) dependencies.error(redact(value.stack ?? value.message, sensitive));
    else dependencies.error('提示: 使用 --debug 查看完整堆栈');
    return 1;
  } finally {
    client.close();
  }
}

function printHelp(): void {
  console.log('Usage: node dist/tools/list_disk_temperatures.js --user USER --password PASSWORD [-e HOST:PORT] [--code 123456] [--trust-device] [--use-ssl] [--skip-ssl-verify true|false] [--debug]');
}

const isDirectExecution = /list_disk_temperatures\.(?:ts|js)$/.test(process.argv[1] ?? '');
if (isDirectExecution) {
  if (process.argv.slice(2).includes('--help')) {
    printHelp();
  } else {
    run(parseToolArgs())
      .then((code) => { process.exitCode = code; })
      .catch((error) => { console.error(redact(String(error))); process.exitCode = 1; });
  }
}
