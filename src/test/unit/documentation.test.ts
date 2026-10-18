import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { version } from '../../index.js';

describe('synchronized documentation', () => {
  it('documents the new public capabilities', async () => {
    const readme = await readFile('README.md', 'utf8');
    for (const text of [
      'submitTwofaCode', 'HTTPSRequiredError', 'BackupManager', 'DownloadCenter',
      'IPBlocker', 'LicenseManager', 'LiveUpdate', 'MountManager',
      'NetworkServer', 'Security', 'SystemRestore', 'list_disk_temperatures',
    ]) assert.match(readme, new RegExp(text));
  });

  it('keeps package, lockfile, and SDK versions aligned with the changelog', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
    const changelog = await readFile('CHANGELOG.md', 'utf8');
    assert.equal(version, pkg.version);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].version, pkg.version);
    assert.ok(changelog.includes(`## [${pkg.version}] - `));
    assert.match(changelog, /## \[Unreleased\]/);
    assert.match(changelog, /71 个只读查询/);
  });
});
