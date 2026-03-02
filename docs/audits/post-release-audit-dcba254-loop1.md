# Post-Release Audit Report (Loop 1)

- Commit: `dcba254`
- Date: 2026-03-02
- Scope: UI simplification, lobby provider fallback, responsive hub/embed behavior, and test coverage.
- Inputs: `plan.json` (ship-20260302T041326Z-e62cec86), commit diff, source/tests/build artifacts.
- Prior review feedback file: `review_report.loop-0.json` was empty (`{}`), so no inherited fix items.

## Work Package Status

| WP | Title | Status | Evidence |
|---|---|---|---|
| WP1 | Provider Resolution + Normalization | Pass | URL normalization tests pass; config precedence verified in `resolveLobbyProviderConfig` and menu provider text/update paths. |
| WP2 | Resilient Fallback Store | Pass (with risk) | Fallback switch logic verified; fallback simulation via code-path review confirms one-way switch to local fallback on network-like/provider errors. |
| WP3 | OnlineSession Lifecycle | Pass | `listOpenRooms`, `hostRoom`, and `joinRoom` all reload provider store before operation. Unit suite passes. |
| WP4 | UI Simplification | Pass (code-level) | Quick actions visible in default view; details overlay hidden by default and toggles correctly. |
| WP5 | Responsive + Embed Verification | Partial | CSS/JS scroll-lock and iframe sizing logic verified; browser/device manual execution still pending in this loop. |
| WP6 | Coverage + Workflow Gates | Pass (with gaps logged) | All required automated gates executed successfully; missing targeted tests categorized below. |

## Acceptance Criteria Matrix

| ID | Status | Notes |
|---|---|---|
| AC1 | Pass | Quick-view primary actions exist in default menu state. |
| AC2 | Pass | Details objects hidden at init and toggled via Show/Hide Details label. |
| AC3 | Pass | Provider text reflects local fallback vs firebase source + trimmed URL. |
| AC4 | Pass | Firebase URL normalization covers missing protocol and `/rooms(.json)` stripping; persisted via localStorage. |
| AC5 | Pass | "Use Bundled Lobby Config" clears local override and repopulates provider fields from resolved config. |
| AC6 | Pass | Local-only sentinel stored and resolved as `config: null` (`source: 'none'`). |
| AC7 | Pass (with risk) | Resilient store falls back to local on matching failures and retries operation. |
| AC8 | Pass | onlineSession reloads store before list/host/join operations. |
| AC9 | Pass | Paging buttons hidden when single page; alpha state updates at bounds; page label maintained. |
| AC10 | Pass | Hub toggles `game-lock-scroll` only for Dou Shou Qi screen. |
| AC11 | Partial | CSS implementation supports no-double-scroll/full-height behavior; device manual run pending. |
| AC12 | Pass | All listed automated checks passed (unit/regression/build). |
| AC13 | Pass | No new assets were introduced in this loop. |

## Findings (Severity-Ordered)

1. `P1` Runtime fallback clarity risk (non-blocking)
- File: `dou-shou-qi/src/net/lobbyStore.ts`
- `shouldFallbackToLocal` treats `Lobby provider request failed (...)` as fallback-eligible, including auth or server-side failures.
- Impact: user may silently move to same-device local lobby when remote config is invalid/unauthorized.
- Recommendation: future patch should narrow fallback predicate to network/CORS/connectivity classes only and surface explicit auth/config errors.

2. `P1` Coverage gap: provider precedence and fallback class behavior
- Files: `dou-shou-qi/src/net/lobbyStore.test.ts`, `dou-shou-qi/src/net/onlineSession.test.ts`
- Missing targeted tests for:
  - local-only sentinel precedence over bundled config
  - bundled config resolution when local override absent
  - resilient fallback one-way switch behavior under specific error classes
- Recommendation: add focused unit tests in a follow-up hardening loop.

3. `P2` Responsive behavior lacks automated guardrails
- Files: `styles.css`, `script.js`
- Current verification is static/code-level only for mobile/desktop behavior.
- Recommendation: add Playwright smoke checks for screen toggle + iframe height/scroll lock assertions.

## Commands Run and Results

- `cd dou-shou-qi && npm test -- --run src/net/lobbyStore.test.ts` -> pass (5/5)
- `cd dou-shou-qi && npm test -- --run src/net/onlineSession.test.ts` -> pass (5/5)
- `node --test tools/auth.test.mjs` -> pass
- `node tools/validate-static-paths.mjs` -> pass (`Static path validation passed.`)
- `cd dou-shou-qi && npm run build` -> pass (vite build successful; non-blocking large chunk warning)

## Release Gate Checklist (Current Recommendation)

Required pre-release checks:
- `node --test tools/auth.test.mjs`
- `node tools/validate-static-paths.mjs`
- `cd dou-shou-qi && npm test`
- `cd dou-shou-qi && npm run build`

Known non-gate:
- `cd dou-shou-qi && npm run lint` (tracked mismatch; keep non-blocking until config modernization)

## Blocking Defect Decision

- Blocking defect found in loop 1: **No**
- Product code changes applied: **None**
- Rationale: all required automated gates pass; observed issues are risk/coverage items appropriate for hardening follow-up.
