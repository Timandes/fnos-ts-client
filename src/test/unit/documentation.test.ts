import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('synchronized documentation', () => {
  it('documents the new public capabilities', async () => {
    const readme = await readFile('README.md', 'utf8');
    for (const text of [
      'submitTwofaCode', 'HTTPSRequiredError', 'BackupManager', 'DownloadCenter',
      'IPBlocker', 'LicenseManager', 'LiveUpdate', 'MountManager',
      'NetworkServer', 'Security', 'SystemRestore', 'list_disk_temperatures',
    ]) assert.match(readme, new RegExp(text));
  });

  it('keeps the package version and records Unreleased changes', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const changelog = await readFile('CHANGELOG.md', 'utf8');
    assert.equal(pkg.version, '0.3.0');
    assert.match(changelog, /## \[Unreleased\]/);
    assert.match(changelog, /71 个只读查询/);
  });
});
