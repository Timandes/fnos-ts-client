import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);

describe('npm package artifact', () => {
  it('ships the compiled disk temperature tool without internal planning documents', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    assert.equal(pkg.scripts['tool:disk-temperatures'], 'node dist/tools/list_disk_temperatures.js');

    const cache = await mkdtemp(join(tmpdir(), 'fnos-npm-cache-'));
    try {
      const { stdout } = await execFileAsync(
        'npm', ['pack', '--dry-run', '--json', '--cache', cache],
        { maxBuffer: 10 * 1024 * 1024 },
      );
      const artifact = JSON.parse(stdout)[0];
      const paths = artifact.files.map((file: { path: string }) => file.path);

      assert.ok(paths.includes('CHANGELOG.md'));
      assert.ok(paths.includes('dist/tools/common.js'));
      assert.ok(paths.includes('dist/tools/list_disk_temperatures.js'));
      assert.ok(!paths.some((path: string) => path.startsWith('docs/superpowers/')));
      assert.ok(!paths.some((path: string) => path.startsWith('dist/test/')));
    } finally {
      await rm(cache, { recursive: true, force: true });
    }
  });

  it('runs the compiled disk temperature tool without tsx', async () => {
    const { stdout } = await execFileAsync(
      process.execPath, ['dist/tools/list_disk_temperatures.js', '--help'],
    );
    assert.match(stdout, /^Usage: node dist\/tools\/list_disk_temperatures\.js /);
  });
});
