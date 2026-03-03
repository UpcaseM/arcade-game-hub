import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const requiredArtifacts = [
  'docs/audits/post-release-audit-dcba254-loop2.md',
  'docs/manual-tests/README.md',
  'docs/manual-tests/dou-shou-qi-ui-smoke.md',
  'docs/manual-tests/lobby-provider-failure-matrix.md',
  'docs/manual-tests/responsive-hub-embed-matrix.md',
  'docs/review/ARTIFACTS.md'
];

const requiredAuditRefs = [
  'docs/manual-tests/dou-shou-qi-ui-smoke.md',
  'docs/manual-tests/lobby-provider-failure-matrix.md',
  'docs/manual-tests/responsive-hub-embed-matrix.md'
];

const manualSentinel = 'Manual:';

async function exists(absolutePath) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function defaultExecGit(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

export async function runVerification({ repoRoot = process.cwd(), execGit = defaultExecGit } = {}) {
  const failures = [];

  for (const relativePath of requiredArtifacts) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!(await exists(absolutePath))) {
      failures.push(`missing artifact: ${relativePath}`);
    }
  }

  const auditPath = path.join(repoRoot, 'docs/audits/post-release-audit-dcba254-loop2.md');
  if (await exists(auditPath)) {
    const auditBody = await readFile(auditPath, 'utf8');
    for (const requiredRef of requiredAuditRefs) {
      if (!auditBody.includes(requiredRef)) {
        failures.push(`audit missing checklist reference: ${requiredRef}`);
      }
    }
  }

  const manualReadmePath = path.join(repoRoot, 'docs/manual-tests/README.md');
  if (await exists(manualReadmePath)) {
    const manualReadmeBody = await readFile(manualReadmePath, 'utf8');
    if (!manualReadmeBody.includes(manualSentinel)) {
      failures.push('manual checklist README missing Manual: sentinel contract');
    }
  }

  const artifactContractPath = path.join(repoRoot, 'docs/review/ARTIFACTS.md');
  if (await exists(artifactContractPath)) {
    const artifactContractBody = await readFile(artifactContractPath, 'utf8');
    if (!artifactContractBody.includes(manualSentinel)) {
      failures.push('artifact contract missing Manual: sentinel reference');
    }
  }

  const tracked = execGit(['ls-files', 'Dou', 'back'], repoRoot);
  if (tracked.status !== 0) {
    failures.push('git ls-files Dou back failed to execute');
  } else if (tracked.stdout.trim().length > 0) {
    failures.push('repo hygiene failed: Dou/back are tracked');
  }

  const douExists = await exists(path.join(repoRoot, 'Dou'));
  const backExists = await exists(path.join(repoRoot, 'back'));
  if (douExists || backExists) {
    failures.push('repo hygiene failed: Dou/back still exist in working tree');
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

async function main() {
  const result = await runVerification();
  if (!result.ok) {
    console.error('Review artifact verification failed:');
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log('Review artifact verification passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
