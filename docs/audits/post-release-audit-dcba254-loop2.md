# Post-Release Audit Report (Loop 4)

- Commit under audit: `dcba254`
- Report date: 2026-03-02
- Scope: UI simplification, lobby provider fallback behavior, responsive hub/embed behavior, and release gates.

## Loop 4 Summary

This loop closed the remaining code-side blocker and tightened fallback coverage:

1. Removed stray tracked root files (`Dou`, `back`) so they no longer ship.
2. Added missing `401` auth-error test coverage to ensure fallback is not triggered on permission/auth failures.
3. Re-ran required automated gates; all pass.

Runtime browser evidence tasks (UI smoke, fallback simulations, responsive matrix) remain blocked in this sandbox due runtime restrictions on local serving and browser execution.

## Implemented Changes

### 1) Repo hygiene cleanup

- Deleted tracked accidental files from repo root:
  - `Dou`
  - `back`
- Verification:
  - `git ls-files Dou back` returns no entries.
  - `test ! -e Dou && test ! -e back` passes.

### 2) Fallback test hardening

- Updated `dou-shou-qi/src/net/lobbyStore.test.ts` with:
  - `does not fallback on auth errors (401)`
- Assertions verify:
  - operations reject with `Lobby provider request failed (401)`
  - no automatic fallback warning
  - no fallback event dispatch

## Validation Results

### Required automated gates

- `node --test tools/auth.test.mjs` -> **pass**
- `node tools/validate-static-paths.mjs` -> **pass**
- `npm --prefix dou-shou-qi test` -> **pass** (`39/39`)
- `npm --prefix dou-shou-qi run build` -> **pass**

### Runtime execution feasibility checks

- Local static server attempt:
  - Command: `python3 -m http.server 8000`
  - Result: **blocked** with `PermissionError: [Errno 1] Operation not permitted` (socket bind denied).
- Browser execution attempt:
  - Command: `chromium-browser --headless ...`
  - Result: **blocked** (`snap-confine` capability denial; cannot create usable sandbox profile in this environment).

## Work Package Snapshot

| WP | Status | Notes |
|---|---|---|
| WP1 Scope + delta mapping | Pass | Unchanged from prior loops. |
| WP2 Static code audit (UI/provider) | Pass | Fallback policy/test hardening preserved; added 401 no-fallback coverage. |
| WP3 Automated gates | Pass | Required automated commands pass. |
| WP4 Runtime UI simplification validation | Fail (env-blocked) | Needs permissive browser runtime. |
| WP5 Runtime fallback + responsive validation | Fail (env-blocked) | Needs permissive browser runtime and evidence capture. |
| WP6 Defect triage/minimal fixes/sign-off | Partial | Blocking repo hygiene fixed; runtime evidence still outstanding. |

## Acceptance Criteria Status (Loop 4)

| AC | Status | Evidence |
|---|---|---|
| AC1 UI simplification flows | Partial | Static code review complete; runtime UI smoke not executable here. |
| AC2 Details overlay behavior | Partial | Static code review complete; runtime interaction evidence pending. |
| AC7 Responsive hub/embed matrix | Fail (env-blocked) | Requires real browser viewport/rotation runs. |
| AC9 Automated gates | Pass | All required commands pass in this loop. |
| AC11 Asset policy | Pass | No new assets introduced. |

## Remaining Required Follow-Ups (Outside Sandbox)

1. Run browser UI smoke for Dou Shou Qi quick view/details, host/join, refresh/paging, tutorial flow; capture dated screenshots.
2. Run provider failure runtime matrix: invalid URL, offline, blocked/CORS-like, auth-denied (401/403); capture console/network evidence and provider text/toast outcomes.
3. Run responsive matrix at ~390 portrait+landscape, ~560, ~860, desktop; repeat hub -> Dou Shou Qi -> back loop x3.
4. Attach evidence links/paths and finalize AC1/AC2/AC7 as Pass/Fail.

## Asset Policy

- No new assets were added in this loop.
- Policy remains: only free/open licensed assets may be added, with attribution + source URL + license text committed in-repo.
