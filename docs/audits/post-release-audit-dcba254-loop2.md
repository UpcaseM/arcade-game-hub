# Post-Release Audit Report (Loop 3)

- Commit under audit: `dcba254`
- Report date: 2026-03-02
- Scope: UI simplification, lobby provider fallback behavior, responsive hub/embed behavior, and release gates.

## Loop 3 Summary

This loop resolved the two code/repo blockers from prior review:

1. Removed stray root files accidentally added to version control (`Dou`, `back`).
2. Reverted out-of-scope same-rank trade-elimination gameplay changes so rules are consistent with release scope.

Runtime browser evidence tasks (UI smoke, fallback simulations, responsive matrix) remain blocked in this sandbox because opening a local HTTP server is not permitted.

## Implemented Changes

### 1) Repo hygiene cleanup

- Deleted tracked accidental files from repo root:
  - `Dou`
  - `back`
- Verification:
  - `git ls-files Dou back` returns no entries.
  - Files are absent on disk.

### 2) Scope regression rollback (game rules)

- Restored capture behavior to release rule semantics:
  - same-rank capture no longer removes both pieces.
  - attacker survives on valid equal-rank capture.
- Updated affected files:
  - `dou-shou-qi/src/data/gameData.ts`
  - `dou-shou-qi/src/data/gameData.test.ts`
  - `dou-shou-qi/src/game/scenes/TutorialScene.ts`
- `dou-shou-qi/README.md` already matched expected rule text and required no change.

## Validation Results

### Required automated gates

- `node --test tools/auth.test.mjs` -> **pass**
- `node tools/validate-static-paths.mjs` -> **pass**
- `npm --prefix dou-shou-qi run lint` -> **pass**
- `npm --prefix dou-shou-qi test` -> **pass** (38/38)
- `npm --prefix dou-shou-qi run build` -> **pass**

### Runtime execution feasibility check

- Attempted local static server:
  - `python3 -m http.server 8000`
- Result: **blocked** with `PermissionError: [Errno 1] Operation not permitted`.
- Consequence: in-browser UI/fallback/responsive matrices cannot be executed in this environment.

## Work Package Snapshot

| WP | Status | Notes |
|---|---|---|
| WP1 Scope + delta mapping | Pass | Unchanged from previous loop. |
| WP2 Static code audit (UI/provider) | Pass | Prior fallback logic/test hardening intact; scope regression removed. |
| WP3 Automated gates | Pass | Required automated commands pass. |
| WP4 Runtime UI simplification validation | Fail (env-blocked) | Needs permissive browser runtime. |
| WP5 Runtime fallback + responsive validation | Fail (env-blocked) | Needs permissive browser runtime and evidence capture. |
| WP6 Defect triage/minimal fixes/sign-off | Partial | Code blockers fixed; runtime evidence still outstanding. |

## Remaining Required Follow-Ups (Outside Sandbox)

1. Execute Dou Shou Qi UI smoke matrix (quick view/details, host/join, refresh/paging, tutorial navigation) and capture screenshots + pass/fail notes.
2. Execute provider failure simulations (invalid URL, offline, blocked/CORS-like, auth-denied 401/403) with console/network notes.
3. Execute responsive hub->Dou Shou Qi embed matrix at ~390 portrait/landscape, ~560, ~860, desktop; repeat hub->game->back loop x3.
4. Attach evidence paths/links and finalize AC1/AC2/AC7/AC9/AC11 as Pass/Fail.

## Asset Policy

- No new assets were added in this loop.
- Policy remains: only free/open licensed assets may be added, with attribution + source URL + license text committed in-repo.
