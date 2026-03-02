# Post-Release Audit Report (Loop 8 Update)

- Commit: `dcba254`
- Date: 2026-03-02
- Scope: UI simplification, lobby provider fallback, responsive hub/embed behavior, and test coverage.
- Inputs: `plan.json` (ship-20260302T050424Z-a8c582be), `review_report.loop-0.json`, source/tests/build artifacts.

## Loop 8 Delta

- Re-ran all required automated gates from the plan:
  - `dou-shou-qi` focused unit suites (`lobbyStore`, `onlineSession`) pass.
  - Hub auth regression test passes.
  - Static path validation passes.
  - `dou-shou-qi` production build passes.
- Reconfirmed loop-7 blocking issues remain unresolved in this sandbox:
  - Real browser runtime validation is still unavailable for responsive, UI smoke, and provider-failure simulations.
  - Screenshot artifact generation remains unavailable in this environment (Playwright browsers not installable here).
  - Local static serving remains blocked (`python3 -m http.server 8000` fails with `PermissionError: [Errno 1] Operation not permitted`).

## Work Package Status

| WP | Title | Status | Evidence |
|---|---|---|---|
| WP1 | Provider Resolution + Normalization | Pass | `lobbyStore` unit suite passes; precedence/normalization behavior remains aligned with code/tests. |
| WP2 | Resilient Fallback Store | **Fail (runtime validation blocked in this environment)** | Required invalid-URL/offline runtime simulations still cannot be executed here due sandbox runtime/browser constraints. |
| WP3 | OnlineSession Lifecycle | Pass | `onlineSession` unit suite passes; provider reload behavior remains covered. |
| WP4 | UI Simplification | **Fail (runtime validation blocked in this environment)** | Interactive host/join/refresh/details/tutorial/paging smoke flow requires real browser runtime, unavailable here. |
| WP5 | Responsive + Embed Verification | **Fail (runtime validation blocked in this environment)** | Desktop/mobile viewport + rotation checks still blocked by sandbox server/browser limits. |
| WP6 | Coverage + Workflow Gates | Pass (with noted gaps) | Automated checks pass; remaining blockers are runtime evidence tasks outside sandbox. |

## Acceptance Criteria Matrix

| ID | Status | Notes |
|---|---|---|
| AC1 | Partial | Quick-view controls exist; interactive runtime validation still blocked. |
| AC2 | Partial | Details toggle logic exists; interactive runtime validation still blocked. |
| AC3 | Pass | Provider text/source resolution behavior remains code-verified. |
| AC4 | Pass | URL normalization/persistence remains unit-covered and passing. |
| AC5 | Pass | Bundled-config reset path remains code-verified. |
| AC6 | Pass | Local-only sentinel resolution remains code-verified. |
| AC7 | **Fail (runtime evidence missing)** | Required invalid URL + offline/blocked real-browser simulations remain blocked here. |
| AC8 | Pass | Unit tests confirm store reload before list/host/join. |
| AC9 | Partial | Paging controls present in code; runtime interaction still unverified in this environment. |
| AC10 | Pass | Hub class toggle logic remains code-verified. |
| AC11 | **Fail (runtime evidence missing)** | Mobile/desktop runtime checks (~390/~560/~860 + desktop + rotation) still blocked here. |
| AC12 | Pass | All required automated checks pass in loop 8. |
| AC13 | Pass | No new assets introduced. |

## Commands Run and Results (Loop 8)

- `cd dou-shou-qi && npm test -- --run src/net/lobbyStore.test.ts` -> pass (`7/7`)
- `cd dou-shou-qi && npm test -- --run src/net/onlineSession.test.ts` -> pass (`5/5`)
- `cd dou-shou-qi && npm test` -> pass (`36/36`)
- `node --test tools/auth.test.mjs` -> pass
- `node tools/validate-static-paths.mjs` -> pass (`Static path validation passed.`)
- `cd dou-shou-qi && npm run build` -> pass (build completes; `dist/index.html` + `dist/main.js` emitted)
- `python3 -m http.server 8000` -> blocked by sandbox (`PermissionError: [Errno 1] Operation not permitted`)
- Runtime browser/manual matrix execution -> blocked in this sandbox environment (external follow-up required)
- Snapshot artifact generation -> blocked in this sandbox environment (external follow-up required)

## Required Runtime Matrix Status

### Responsive matrix (~390/~560/~860 + desktop, portrait/landscape)

| Scenario | Runtime execution | Status |
|---|---|---|
| Desktop hub -> Dou Shou Qi -> Back to hub (repeat) | Blocked by sandbox (no local server/browser runtime) | Fail |
| Mobile width ~390 (portrait + landscape) | Blocked by sandbox | Fail |
| Tablet width ~560 | Blocked by sandbox | Fail |
| Small desktop width ~860 | Blocked by sandbox | Fail |

Static code evidence retained:
- `styles.css` includes `body.game-lock-scroll` with `height: 100dvh` and `overflow: hidden`.
- `styles.css` includes Dou Shou Qi iframe rules for normal mode and `game-lock-scroll` mode (`#douShouQiFrame` + `.dou-iframe-shell`).
- `script.js` toggles `game-lock-scroll` only on `douShouQi` screen and unloads iframe back to `about:blank` on exit.

### Provider failure simulation matrix (invalid URL + offline/blocked)

| Scenario | Runtime execution | Status |
|---|---|---|
| Invalid lobby URL in Details -> Refresh/Host | Blocked by sandbox | Fail |
| Offline/blocked provider request -> Refresh/Host | Blocked by sandbox | Fail |

Static/automated evidence retained:
- `dou-shou-qi/src/net/lobbyStore.ts` fallback trigger logic remains as expected for network-like failures.
- Unit suites and regression/build checks pass, but do not replace runtime browser simulation evidence.

### UI simplification interactive smoke matrix

| Scenario | Runtime execution | Status |
|---|---|---|
| Start Local Match / Host / Refresh / Tutorial | Blocked by sandbox | Fail |
| Show/Hide Details and return to quick view | Blocked by sandbox | Fail |
| Join locked/unlocked and paging Prev/Next | Blocked by sandbox | Fail |

Static code evidence retained:
- Main menu quick-view actions are present.
- Details overlay defaults hidden and toggles `Show Details` <-> `Hide Details`.
- Paging controls (`Prev`/`Next` + page label) remain present.

## Snapshot Evidence

No screenshot artifact pack was generated in this sandbox loop because browser runtime setup is blocked. Snapshot evidence remains an external follow-up requirement for WP4/WP5 sign-off.

## Next Required Follow-Up (Outside This Sandbox)

1. Serve the repo in a permissive environment and run the responsive matrix (~390/~560/~860 + desktop + rotation).
2. Execute provider failure simulation #1 (invalid lobby URL) and #2 (offline/blocked request), capturing console/network evidence.
3. Execute the full interactive UI smoke flow (host/join/details/tutorial/paging) and capture evidence.
4. Attach screenshot/video artifacts and update WP2/WP4/WP5 and AC1/AC2/AC7/AC9/AC11 from Partial/Fail to Pass/Fail based on real runtime results.
