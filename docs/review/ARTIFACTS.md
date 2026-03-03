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
node tools/verify-review-artifacts.mjs
git ls-files Dou back
```

## Workflow terminal-state artifacts

- `state/runs/<run_id>/implementation_report.loop-1.json`
- `state/runs/<run_id>/run_state.json`
- Terminal `run_state.status` must be one of: `DELIVERED`, `USER_BLOCKED`, `FAILED`.

When those runtime paths are available, pass them to the verifier:

```bash
WORKFLOW_IMPLEMENTATION_REPORT_PATH=state/runs/<run_id>/implementation_report.loop-1.json \
WORKFLOW_RUN_STATE_PATH=state/runs/<run_id>/run_state.json \
node tools/verify-review-artifacts.mjs
```

## Canonical manual gate entries

Manual checklist commands must use an explicit `Manual:` sentinel so workflow runners classify them as manual and skip shell execution.

```bash
Manual: python3 -m http.server 8000; execute docs/manual-tests/*.md and capture evidence under docs/evidence/<checklist-id>/YYYYMMDD-*.png
```
