import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runVerification, requiredArtifacts } from './verify-review-artifacts.mjs';

async function seedArtifacts(repoRoot, { includeAuditRefs = true } = {}) {
  for (const relativePath of requiredArtifacts) {
    const absolutePath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    let content = '# placeholder\n';
    if (relativePath.endsWith('post-release-audit-dcba254-loop2.md') && includeAuditRefs) {
      content = [
        '# audit',
        'docs/manual-tests/dou-shou-qi-ui-smoke.md',
        'docs/manual-tests/lobby-provider-failure-matrix.md',
        'docs/manual-tests/responsive-hub-embed-matrix.md'
      ].join('\n');
    }
    if (relativePath.endsWith('docs/manual-tests/README.md')) {
      content = ['# manual tests', 'Manual: python3 -m http.server 8000'].join('\n');
    }
    if (relativePath.endsWith('docs/review/ARTIFACTS.md')) {
      content = [
        '# artifacts',
        'node tools/verify-review-artifacts.mjs',
        'Manual: execute docs/manual-tests/*.md'
      ].join('\n');
    }
    await writeFile(absolutePath, content, 'utf8');
  }
}

test('runVerification passes when artifacts/references/hygiene are valid', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'artifact-verify-pass-'));
  await seedArtifacts(repoRoot);

  const result = await runVerification({
    repoRoot,
    execGit: () => ({ status: 0, stdout: '', stderr: '' })
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test('runVerification fails when audit checklist links are missing', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'artifact-verify-audit-'));
  await seedArtifacts(repoRoot, { includeAuditRefs: false });

  const result = await runVerification({
    repoRoot,
    execGit: () => ({ status: 0, stdout: '', stderr: '' })
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.failures.some((failure) => failure.includes('audit missing checklist reference')),
    true
  );
});

test('runVerification fails when Dou/back are tracked', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'artifact-verify-hygiene-'));
  await seedArtifacts(repoRoot);

  const result = await runVerification({
    repoRoot,
    execGit: () => ({ status: 0, stdout: 'Dou\nback\n', stderr: '' })
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.failures.includes('repo hygiene failed: Dou/back are tracked'),
    true
  );
});

test('runVerification fails when manual README is missing Manual: sentinel', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'artifact-verify-manual-readme-'));
  await seedArtifacts(repoRoot);
  await writeFile(path.join(repoRoot, 'docs/manual-tests/README.md'), '# manual tests\n', 'utf8');

  const result = await runVerification({
    repoRoot,
    execGit: () => ({ status: 0, stdout: '', stderr: '' })
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.failures.includes('manual checklist README missing Manual: sentinel contract'),
    true
  );
});

test('runVerification fails when artifact contract is missing Manual: sentinel', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'artifact-verify-artifact-contract-'));
  await seedArtifacts(repoRoot);
  await writeFile(path.join(repoRoot, 'docs/review/ARTIFACTS.md'), '# artifacts\n', 'utf8');

  const result = await runVerification({
    repoRoot,
    execGit: () => ({ status: 0, stdout: '', stderr: '' })
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.failures.includes('artifact contract missing Manual: sentinel reference'),
    true
  );
});

test('runVerification fails when artifact contract is missing verifier command', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'artifact-verify-missing-command-'));
  await seedArtifacts(repoRoot);
  await writeFile(
    path.join(repoRoot, 'docs/review/ARTIFACTS.md'),
    '# artifacts\nManual: execute docs/manual-tests/*.md\n',
    'utf8'
  );

  const result = await runVerification({
    repoRoot,
    execGit: () => ({ status: 0, stdout: '', stderr: '' })
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.failures.includes('artifact contract missing verifier command reference'),
    true
  );
});
