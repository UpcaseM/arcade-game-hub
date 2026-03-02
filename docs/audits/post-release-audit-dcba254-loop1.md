# Post-Release Audit Report (Loop 2)

- Commit under audit: `dcba254`
- Report date: 2026-03-02
- Scope: UI simplification, lobby provider fallback behavior, responsive hub/embed behavior, and release gates.

## Loop 2 Summary

Blocking fixes from `review_report.loop-1.json` were implemented for:

1. Lint gate failure (`BI-1`) via ESLint v9 flat config.
2. Fallback classification and behavior risk (`BI-2`) via explicit HTTP error typing and stricter fallback rules.
3. User-visible fallback signal (`BI-2`) via global fallback event consumed by the main menu toast.

Runtime browser evidence requirements (`BI-3`) remain blocked in this sandbox because local HTTP serving is not permitted.

## Implemented Changes

### 1) ESLint v9 gate restored

- Added `dou-shou-qi/eslint.config.mjs` (flat config).
- Updated `dou-shou-qi/package.json` lint script to `eslint "src/**/*.ts"`.
- `npm --prefix dou-shou-qi run lint` now passes.

### 2) Fallback policy hardened

- `FirebaseLobbyStore.fetchJson` now throws a typed `LobbyProviderHttpError` with explicit status code.
- Fallback decision logic now:
  - falls back on network-like failures (`Failed to fetch`, `NetworkError`, `fetch failed`, `Network request failed`, `Load failed`);
  - falls back on HTTP `5xx`;
  - does **not** fallback on HTTP `4xx` (including 401/403).
- Added `LOBBY_PROVIDER_FALLBACK_EVENT` and dispatch when automatic fallback occurs.

### 3) User-visible fallback messaging

- `DouShouQiMainMenuScene` now subscribes to `LOBBY_PROVIDER_FALLBACK_EVENT`.
- On automatic fallback, UI shows toast:
  - `Remote lobby unavailable; using local-only lobby (same-device only).`
- Listener cleanup is wired on scene shutdown/destroy.

## Test Coverage Updates

Updated `dou-shou-qi/src/net/lobbyStore.test.ts` to cover:

- fallback on network fetch errors (existing, now also asserts fallback event emission),
- no fallback on HTTP 403 permission errors,
- fallback on HTTP 503 provider failures,
- no fallback on HTTP 404 provider failures (and no fallback event).

## Gate Results (Loop 2)

- `npm --prefix dou-shou-qi run lint` -> **pass**
- `npm --prefix dou-shou-qi run test -- --run src/net/lobbyStore.test.ts src/net/onlineSession.test.ts` -> **pass**
- `node --test tools/auth.test.mjs` -> **pass**
- `node tools/validate-static-paths.mjs` -> **pass**
- `npm --prefix dou-shou-qi test` -> **pass** (`39/39`)
- `npm --prefix dou-shou-qi run build` -> **pass**

## Runtime Evidence Status

### UI simplification smoke flow

- Status: **blocked in this environment**
- Reason: local static server startup fails with `PermissionError: [Errno 1] Operation not permitted`.

### Provider failure simulations (invalid URL/offline/blocked/auth-denied)

- Status: **partially covered by unit tests; runtime browser evidence blocked**
- Unit evidence: fallback/no-fallback classification is now validated in `lobbyStore.test.ts`.
- Runtime browser simulation remains pending outside this sandbox.

### Responsive hub/embed matrix (~390 portrait+landscape, ~560, ~860, desktop)

- Status: **blocked in this environment**
- Reason: no usable local browser runtime due local server restriction.

## Work Package Snapshot

| WP | Status | Notes |
|---|---|---|
| WP1 Scope + delta mapping | Pass | Maintained from prior loops. |
| WP2 Static code audit (UI/provider) | Pass | Blocking classification defect fixed and tested. |
| WP3 Automated gates | Pass | Required commands pass including restored lint gate. |
| WP4 Runtime UI simplification validation | Fail (env-blocked) | Needs permissive browser runtime. |
| WP5 Runtime fallback + responsive validation | Fail (env-blocked) | Needs permissive browser runtime and evidence capture. |
| WP6 Defect triage/minimal fixes/sign-off | Partial | Blocking code defects fixed; runtime evidence tasks remain. |

## Remaining Follow-Ups (Outside Sandbox)

1. Run browser-based UI smoke matrix for quick view/details/tutorial/host/join/paging flows.
2. Run runtime fallback matrix for invalid URL, offline/blocked, and auth-denied in real browser DevTools.
3. Run responsive hub/embed matrix at ~390 portrait+landscape, ~560, ~860, and desktop with hub->game->back loop x3.
4. Attach screenshots/video/log snippets and finalize AC1/AC2/AC7/AC9/AC11.

## Asset Policy

- No new assets were added in this loop.
- Policy remains: only free/open licensed assets with in-repo attribution/license text for any future additions.

## Loop 4 Carry-Forward Update (2026-03-02)

- Repo hygiene blocker is now resolved: tracked root files `Dou` and `back` were removed.
- Added fallback regression coverage for HTTP `401` in `dou-shou-qi/src/net/lobbyStore.test.ts` to enforce no auto-fallback on auth failures.
- Required automated gates pass in loop 4:
  - `node --test tools/auth.test.mjs`
  - `node tools/validate-static-paths.mjs`
  - `npm --prefix dou-shou-qi test`
  - `npm --prefix dou-shou-qi run build`
- Runtime browser matrices remain environment-blocked in this sandbox due:
  - socket bind restrictions (`python3 -m http.server` -> `PermissionError: [Errno 1] Operation not permitted`)
  - restricted Chromium snap runtime (`snap-confine` capability denial)
- Latest status and evidence are tracked in `docs/audits/post-release-audit-dcba254-loop2.md` (Loop 4 report).
