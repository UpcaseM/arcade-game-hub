# Manual Test Checklists

This directory is the single source of truth for manual runtime validation.

## Checklists

- `docs/manual-tests/dou-shou-qi-ui-smoke.md`
- `docs/manual-tests/lobby-provider-failure-matrix.md`
- `docs/manual-tests/responsive-hub-embed-matrix.md`

## When to run

- Before final audit sign-off when UI, lobby provider behavior, or embed/responsive layout changes.
- Any time automated checks pass but browser-runtime behavior still needs evidence.

## Evidence format

- Date: `YYYY-MM-DD`
- Environment: local browser + OS (for example `Chrome 124 / Ubuntu 24.04`)
- Status per item: `Pass`, `Fail`, or `Blocked`
- Evidence path format: `docs/evidence/<checklist-id>/<YYYYMMDD>-<short-name>.png`
- Optional log snippet path: `docs/evidence/<checklist-id>/<YYYYMMDD>-<short-name>.txt`

## Repo hygiene gate

Run this in repo root before sign-off:

```bash
git ls-files Dou back
test ! -e Dou && test ! -e back
```

Pass criteria:
- `git ls-files Dou back` prints no lines.
- Both paths are absent from working tree.

## Outside-sandbox execution

If this environment cannot bind a local server or run a browser, run the checklists on a permissive machine using:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` and capture screenshots/logs using the evidence format above.
