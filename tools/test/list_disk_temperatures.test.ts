import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDiskTemperatures, formatDiskTemperatures, redact, run,
  type ToolDependencies,
} from '../list_disk_temperatures.js';
import type { ToolArgs } from '../common.js';

describe('disk temperature diagnostic', () => {
  it('uses monitor temperature without SMART', async () => {
    let smartCalls = 0;
    const store = {
      listDisks: async () => ({ disk: [{ name: 'sda' }] }),
      getDiskSmart: async () => { smartCalls += 1; return {}; },
    };
    const monitor = { disk: async () => ({ data: { disk: [{ name: 'sda', temp: 42 }] } }) };
    const result = await collectDiskTemperatures(store, monitor);
    assert.deepEqual(result, [{ name: 'sda', temperature: 42, source: 'ResourceMonitor.disk().data.disk[].temp', skipped: [] }]);
    assert.equal(smartCalls, 0);
  });

  it('falls back from zero monitor and missing SATA SMART to NVMe', async () => {
    const store = {
      listDisks: async () => ({ disk: [{ name: 'nvme0n1' }] }),
      getDiskSmart: async () => ({ smart: { nvme_smart_health_information_log: { temperature: 51 } } }),
    };
    const monitor = { disk: async () => ({ data: { disk: [{ name: 'nvme0n1', temp: 0 }] } }) };
    const [result] = await collectDiskTemperatures(store, monitor);
    assert.equal(result.temperature, 51);
    assert.match(result.skipped.join('\n'), /值为 0/);
    assert.match(result.skipped.join('\n'), /字段不存在/);
    assert.match(formatDiskTemperatures([result]), /nvme0n1 => 51°C/);
  });

  it('isolates monitor and per-disk SMART failures', async () => {
    const store = {
      listDisks: async () => ({ disk: [{ name: 'sda' }, { name: 'sdb' }] }),
      getDiskSmart: async (name: string) => {
        if (name === 'sda') throw new Error('SMART unavailable');
        return { smart: { temperature: { current: 39 } } };
      },
    };
    const monitor = { disk: async () => { throw new Error('monitor unavailable'); } };
    const result = await collectDiskTemperatures(store, monitor);
    assert.equal(result[0].temperature, undefined);
    assert.equal(result[1].temperature, 39);
    assert.match(result[0].skipped.join('\n'), /monitor unavailable/);
    assert.match(result[0].skipped.join('\n'), /SMART unavailable/);
  });

  it('redacts exact values and authentication fields', () => {
    const text = 'password=secret token: abc accessToken="xyz" code=583213';
    const result = redact(text, ['secret', '583213']);
    assert.doesNotMatch(result, /secret|abc|xyz|583213/);
    assert.match(result, /\*\*\*/);
  });

  it('reports the failing stage, redacts credentials, and closes', async () => {
    const errors: string[] = [];
    let closed = false;
    const args: ToolArgs = {
      user: 'alice', password: 'password', endpoint: 'nas.example.com:5666',
      code: '583213', trustDevice: false, useSsl: false,
      skipSslVerify: true, debug: false,
    };
    const client = {
      connect: async () => true,
      login: async () => { throw new Error('token=abc password=password code=583213'); },
      close: () => { closed = true; },
    };
    const dependencies: ToolDependencies = {
      createClient: () => client as never,
      createStore: () => ({ listDisks: async () => ({ disk: [] }), getDiskSmart: async () => ({}) }),
      createMonitor: () => ({ disk: async () => ({ data: { disk: [] } }) }),
      log: () => undefined,
      error: (message) => { errors.push(message); },
    };
    assert.equal(await run(args, dependencies), 1);
    assert.equal(closed, true);
    assert.match(errors.join('\n'), /登录或两步验证阶段失败/);
    assert.doesNotMatch(errors.join('\n'), /abc|password=password|583213/);
  });
});
