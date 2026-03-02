# Post-Release Audit Report (Loop 2 Update)

- Commit: `dcba254`
- Date: 2026-03-02
- Scope: UI simplification, lobby provider fallback, responsive hub/embed behavior, and test coverage.
- Inputs: `plan.json` (ship-20260302T041326Z-e62cec86), `review_report.loop-1.json`, source/tests/build artifacts.

## Work Package Status

| WP | Title | Status | Evidence |
|---|---|---|---|
| WP1 | Provider Resolution + Normalization | Pass | `lobbyStore` unit suite passes; code-path review still matches documented precedence/normalization behavior. |
| WP2 | Resilient Fallback Store | **Fail (runtime validation blocked in this environment)** | Required invalid-URL/offline runtime simulations could not be executed because sandbox denies socket/network operations needed for local serving/browser automation (`PermissionError: [Errno 1] Operation not permitted`, `EAI_AGAIN` npm registry resolution failure). |
| WP3 | OnlineSession Lifecycle | Pass | `onlineSession` unit suite passes; provider reload behavior remains covered by existing tests. |
| WP4 | UI Simplification | **Fail (runtime validation blocked in this environment)** | Required interactive host/join/refresh/details/tutorial smoke flow could not run without browser runtime access. |
| WP5 | Responsive + Embed Verification | **Fail (runtime validation blocked in this environment)** | Required desktop/mobile viewport + rotation checks could not run; local HTTP server and browser automation both blocked by sandbox permissions. |
| WP6 | Coverage + Workflow Gates | Pass (with noted gaps) | Automated gates re-run and passing; runtime-only evidence remains unavailable in this loop due execution constraints. |

## Acceptance Criteria Matrix

| ID | Status | Notes |
|---|---|---|
| AC1 | Partial | Code-level verified previously; runtime quick-flow validation blocked this loop. |
| AC2 | Partial | Code-level verified previously; runtime details-toggle interaction validation blocked this loop. |
| AC3 | Pass | Provider text logic and source resolution behavior unchanged and code-verified. |
| AC4 | Pass | URL normalization/persistence remains covered by passing unit tests. |
| AC5 | Pass | Bundled-config reset path remains code-verified; no regressions observed in automated checks. |
| AC6 | Pass | Local-only sentinel resolution remains code-verified and unit-backed. |
| AC7 | **Fail (runtime evidence missing)** | Requested real failure simulations (invalid URL + offline/blocked request) not executable in this sandbox. |
| AC8 | Pass | Existing unit tests still confirm store reload before list/host/join flows. |
| AC9 | Partial | Code-level paging logic remains intact; interactive paging behavior not runtime-validated in this loop. |
| AC10 | Pass | Hub class toggle logic remains code-verified and unchanged. |
| AC11 | **Fail (runtime evidence missing)** | Mobile/desktop runtime checks not executable in this sandbox. |
| AC12 | Pass | All required automated checks pass in this loop (tests + static-paths + build). |
| AC13 | Pass | No new assets introduced. |

## Runtime Validation Attempts and Blockers

1. Local manual/runtime server setup failed:
- Command attempted: `python3 -m http.server 8000`
- Result: `PermissionError: [Errno 1] Operation not permitted` when creating socket.

2. Browser runtime automation failed:
- Command attempted: `chromium-browser --headless ... --remote-debugging-port=9222`
- Result: snap confinement/capability error (`required permitted capability cap_dac_override not found`).

3. Playwright prerequisite install failed:
- Command attempted: `npx playwright install`
- Result: DNS/network restriction (`EAI_AGAIN registry.npmjs.org`).

Because of these constraints, required runtime checks from review loop 1 could not be completed in this execution environment.

## Commands Run and Results (Loop 2)

- `cd dou-shou-qi && npm test -- --run src/net/lobbyStore.test.ts` -> pass (5/5)
- `cd dou-shou-qi && npm test -- --run src/net/onlineSession.test.ts` -> pass (5/5)
- `node --test tools/auth.test.mjs` -> pass
- `node tools/validate-static-paths.mjs` -> pass (`Static path validation passed.`)
- `cd dou-shou-qi && npm run build` -> pass (vite build successful; non-blocking chunk-size warning)
- `python3 -m http.server 8000` -> fail (sandbox socket permission denied)
- `chromium-browser --headless ... --remote-debugging-port=9222` -> fail (snap capability permission denied)
- `npx playwright install` -> fail (network/DNS restricted to npm registry)

## Next Required Follow-Up (Outside This Sandbox)

1. Run the three blocked runtime validations in an environment that allows local serving + browser automation.
2. Record explicit pass/fail evidence for:
- WP2/AC7 provider failure simulations (invalid provider URL + offline/blocked request).
- WP4 AC1/AC2/AC9 interactive quick-flow/details/paging checks.
- WP5/AC11 responsive desktop/mobile + rotation checks.
3. If Playwright snapshots are required by the workflow, install browsers and attach generated files, else explicitly waive snapshots with rationale.
