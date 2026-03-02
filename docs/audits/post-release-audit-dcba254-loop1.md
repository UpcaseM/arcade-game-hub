# Post-Release Audit Report (Loop 3 Update)

- Commit: `dcba254`
- Date: 2026-03-02
- Scope: UI simplification, lobby provider fallback, responsive hub/embed behavior, and test coverage.
- Inputs: `plan.json` (ship-20260302T041326Z-e62cec86), `review_report.loop-2.json`, source/tests/build artifacts.

## Work Package Status

| WP | Title | Status | Evidence |
|---|---|---|---|
| WP1 | Provider Resolution + Normalization | Pass | `lobbyStore` unit suite passes; code-path review still matches documented precedence/normalization behavior. |
| WP2 | Resilient Fallback Store | **Fail (runtime validation blocked in this environment)** | Required invalid-URL/offline runtime simulations still cannot be executed because sandbox denies socket/network operations needed for local serving/browser automation (`PermissionError: [Errno 1] Operation not permitted`, `EAI_AGAIN` npm registry resolution failure). |
| WP3 | OnlineSession Lifecycle | Pass | `onlineSession` unit suite passes; provider reload behavior remains covered by existing tests. |
| WP4 | UI Simplification | **Fail (runtime validation blocked in this environment)** | Required interactive host/join/refresh/details/tutorial/paging smoke flow could not run without browser runtime access. |
| WP5 | Responsive + Embed Verification | **Fail (runtime validation blocked in this environment)** | Required desktop/mobile viewport + rotation checks (~390/~560/~860 + desktop) could not run; local HTTP server and browser automation both blocked by sandbox permissions. |
| WP6 | Coverage + Workflow Gates | Pass (with noted gaps) | Automated gates re-run and passing; runtime-only evidence remains unavailable in this loop due execution constraints. |

## Acceptance Criteria Matrix

| ID | Status | Notes |
|---|---|---|
| AC1 | Partial | Quick-view controls exist in scene code; interactive runtime quick-flow validation remains blocked this loop. |
| AC2 | Partial | Details overlay toggle is present in scene code; interactive runtime validation remains blocked this loop. |
| AC3 | Pass | Provider text logic and source resolution behavior unchanged and code-verified. |
| AC4 | Pass | URL normalization/persistence remains covered by passing unit tests. |
| AC5 | Pass | Bundled-config reset path remains code-verified; no regressions observed in automated checks. |
| AC6 | Pass | Local-only sentinel resolution remains code-verified and unit-backed. |
| AC7 | **Fail (runtime evidence missing)** | Requested real failure simulations (invalid URL + offline/blocked request) are still not executable in this sandbox. |
| AC8 | Pass | Existing unit tests still confirm store reload before list/host/join flows. |
| AC9 | Partial | Paging controls remain present in scene code; interactive paging behavior not runtime-validated in this loop. |
| AC10 | Pass | Hub class toggle logic remains code-verified and unchanged. |
| AC11 | **Fail (runtime evidence missing)** | Mobile/desktop runtime checks (~390/~560/~860 + desktop + rotation) not executable in this sandbox. |
| AC12 | Pass | All required automated checks pass in this loop (tests + static-paths + build). |
| AC13 | Pass | No new assets introduced. |

## Runtime Validation Attempts and Blockers

1. Local manual/runtime server setup failed (again in loop 3):
- Command attempted: `python3 -m http.server 8000`
- Result: `PermissionError: [Errno 1] Operation not permitted` when creating socket.

2. Browser runtime automation failed:
- Command attempted: `google-chrome --headless --disable-gpu --no-sandbox --screenshot=... file:///.../index.html`
- Result: crashpad socket capability failure (`setsockopt: Operation not permitted`) followed by `Trace/breakpoint trap (core dumped)`.
- Command attempted: `chromium-browser --headless ... --remote-debugging-port=9222`
- Result: snap confinement/capability error (`required permitted capability cap_dac_override not found`).

3. Playwright prerequisite install failed:
- Command attempted: `npx playwright install`
- Result: DNS/network restriction (`EAI_AGAIN registry.npmjs.org`).

Because of these constraints, required runtime checks from review loop 1 could not be completed in this execution environment.

## Commands Run and Results (Loop 3)

- `cd dou-shou-qi && npm test -- --run src/net/lobbyStore.test.ts` -> pass (5/5)
- `cd dou-shou-qi && npm test -- --run src/net/onlineSession.test.ts` -> pass (5/5)
- `node --test tools/auth.test.mjs` -> pass
- `node tools/validate-static-paths.mjs` -> pass (`Static path validation passed.`)
- `cd dou-shou-qi && npm run build` -> pass (vite build successful; non-blocking chunk-size warning)
- `python3 -m http.server 8000` -> fail (sandbox socket permission denied)
- `google-chrome --headless --disable-gpu --no-sandbox --screenshot=... file:///.../index.html` -> fail (`setsockopt: Operation not permitted`; process trapped)
- `chromium-browser --headless ... --remote-debugging-port=9222` -> fail (snap capability permission denied)
- `npx playwright install` -> fail (network/DNS restricted to npm registry)

## Required Runtime Matrix Status

### Responsive matrix (~390/~560/~860 + desktop, portrait/landscape)

| Scenario | Runtime execution | Status |
|---|---|---|
| Desktop hub -> Dou Shou Qi -> Back to hub (repeat) | Blocked by sandbox (cannot run local server/browser) | Fail |
| Mobile width ~390 (portrait + landscape) | Blocked by sandbox | Fail |
| Tablet width ~560 | Blocked by sandbox | Fail |
| Small desktop width ~860 | Blocked by sandbox | Fail |

Static code evidence retained:
- `styles.css` includes `body.game-lock-scroll` with `height: 100dvh` and `overflow: hidden`.
- `styles.css` includes Dou Shou Qi iframe rules for normal mode and `game-lock-scroll` mode (`#douShouQiFrame` + `.dou-iframe-shell`).
- `script.js` toggles body class only on `douShouQi` screen and unloads iframe back to `about:blank` on exit.

### Provider failure simulation matrix (invalid URL + offline/blocked)

| Scenario | Runtime execution | Status |
|---|---|---|
| Invalid lobby URL in Details -> Refresh/Host | Blocked by sandbox | Fail |
| Offline/blocked provider request -> Refresh/Host | Blocked by sandbox | Fail |

Static/automated evidence retained:
- `dou-shou-qi/src/net/lobbyStore.ts` fallback trigger logic still matches expected error patterns and one-way fallback switching.
- Unit suites (`lobbyStore`, `onlineSession`) and hub regression/build checks pass in this loop.

### UI simplification interactive smoke matrix

| Scenario | Runtime execution | Status |
|---|---|---|
| Start Local Match / Host / Refresh / Tutorial | Blocked by sandbox | Fail |
| Show/Hide Details and return to quick view | Blocked by sandbox | Fail |
| Join locked/unlocked and paging Prev/Next | Blocked by sandbox | Fail |

Static code evidence retained:
- Main menu includes quick-view actions (`Start Local Match`, `Host Room`, `Refresh Room List`, `Show Details`, `Tutorial`).
- Details overlay defaults hidden and toggle label switches `Show Details` <-> `Hide Details`.
- Paging controls (`Prev`/`Next` and page label) remain present.

## Snapshot Evidence Decision

Loop 3 chooses option **B (explicit waiver)** for in-sandbox execution evidence:
- Playwright browser install is not possible in this environment (`EAI_AGAIN` on npm registry).
- Browser execution itself is sandbox-blocked (socket/capability errors).
- Therefore no local screenshot artifacts can be generated from this environment.

Required external follow-up: capture desktop/mobile screenshots in an environment with browser + local server permissions and attach them to the release evidence pack.

## Next Required Follow-Up (Outside This Sandbox)

1. Run the three blocked runtime validations in an environment that allows local serving + browser automation.
2. Record explicit pass/fail evidence for:
- WP2/AC7 provider failure simulations (invalid provider URL + offline/blocked request).
- WP4 AC1/AC2/AC9 interactive quick-flow/details/paging checks.
- WP5/AC11 responsive desktop/mobile + rotation checks.
3. If Playwright snapshots are required by the workflow, install browsers and attach generated files, else explicitly waive snapshots with rationale.
