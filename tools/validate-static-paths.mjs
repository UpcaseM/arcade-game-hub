import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const requiredFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'alien-arena/index.html',
  'dojo-brawler/index.html',
  'dou-shou-qi/dist/index.html'
];

const repoRoot = process.cwd();

async function fileExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function collectAbsoluteAssetRefs(html) {
  const refs = [];
  const regex = /(href|src)\s*=\s*(["'])(.*?)\2/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const value = match[3].trim();
    if (!value) {
      continue;
    }

    const isAbsoluteLocalPath =
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.startsWith('/#');

    if (isAbsoluteLocalPath) {
      refs.push(value);
    }
  }

  return refs;
}

async function main() {
  const missing = [];

  for (const relativePath of requiredFiles) {
    if (!(await fileExists(relativePath))) {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    console.error('Missing required static files:');
    for (const missingFile of missing) {
      console.error(`- ${missingFile}`);
    }
    process.exit(1);
  }

  const rootIndexHtml = await readFile(path.join(repoRoot, 'index.html'), 'utf8');
  if (rootIndexHtml.includes('dou-shou-qi/dist/main.js')) {
    console.error('Unexpected direct script include found: dou-shou-qi/dist/main.js');
    process.exit(1);
  }

  const douDistHtmlPath = path.join(repoRoot, 'dou-shou-qi/dist/index.html');
  const douDistHtml = await readFile(douDistHtmlPath, 'utf8');
  const absoluteRefs = collectAbsoluteAssetRefs(douDistHtml);

  if (absoluteRefs.length > 0) {
    console.error('Root-absolute href/src values detected in dou-shou-qi/dist/index.html:');
    for (const ref of absoluteRefs) {
      console.error(`- ${ref}`);
    }
    process.exit(1);
  }

  console.log('Static path validation passed.');
}

await main();
