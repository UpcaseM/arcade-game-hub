# Review Loop Artifact Contract

This file defines stable artifacts for each release-review loop.

## Required artifacts

| Artifact | Stable path | Type | Minimum required content |
|---|---|---|---|
| Narrative audit report | `docs/audits/post-release-audit-dcba254-loop2.md` | Narrative | Scope, implemented changes, command results, open blockers |
| Manual checklist index | `docs/manual-tests/README.md` | Manual | Checklist links, evidence naming, outside-sandbox instructions |
| UI smoke checklist | `docs/manual-tests/dou-shou-qi-ui-smoke.md` | Manual | Atomic items with status and evidence fields |
| Provider failure checklist | `docs/manual-tests/lobby-provider-failure-matrix.md` | Manual | Scenario matrix with fallback expectation |
| Responsive checklist | `docs/manual-tests/responsive-hub-embed-matrix.md` | Manual | Viewport matrix with status/evidence fields |
| Artifact verifier | `tools/verify-review-artifacts.mjs` | Automated | Fails on missing artifacts, missing checklist links, or Dou/back hygiene breach |

## Canonical automated gates

```bash
node --test tools/auth.test.mjs
node tools/validate-static-paths.mjs
npm --prefix dou-shou-qi run lint
npm --prefix dou-shou-qi test
npm --prefix dou-shou-qi run build
npm --prefix alien-arena-phaser run lint
npm --prefix alien-arena-phaser test
npm --prefix alien-arena-phaser run build
git ls-files Dou back
```

## Canonical manual gate entries

Manual checklist commands must use an explicit `Manual:` sentinel so workflow runners classify them as manual and skip shell execution.

```bash
Manual: python3 -m http.server 8000; execute docs/manual-tests/*.md and capture evidence under docs/evidence/<checklist-id>/YYYYMMDD-*.png
```
