# MVP Account + Multiplayer Delivery Report

## Implemented in this loop

1. Hub auth/UI safety and polish
- Removed default admin credential hint from the public login modal UI.
- Kept existing login/logout/admin behavior unchanged.
- Updated hub styling to a cohesive forest direction and improved spacing/alignment for desktop + mobile.

2. Dou Shou Qi multiplayer lobby flow
- Replaced manual offer/answer prompts from menu with a room-lobby flow.
- Replaced browser `prompt/alert` flows with in-scene input panels and inline status toasts.
- Added lobby data model + store abstraction in `dou-shou-qi/src/net/lobbyStore.ts`.
- Added provider modes:
  - Firebase Realtime Database REST mode (cross-device room listing/signaling from bundled config by default).
  - Local browser fallback mode (same-device/local-storage only).
- Host flow:
  - Host creates room (optional password), enters lobby immediately.
  - Lobby shows guest/connect status and enables `Start Match` only when guest channel is connected.
- Guest flow:
  - Guest opens room list, sees currently open rooms, and joins by clicking `Join`.
  - Locked rooms require password.
- Added lobby scene: `dou-shou-qi/src/game/scenes/LobbyScene.ts`.

3. Password + reconnect behavior
- Room password is optional.
- Password handling stores only `salt + SHA-256 hash` in room metadata (no plaintext storage).
- Reconnect now reuses the same room and bumps offer/answer version in room metadata.
- In-game reconnect buttons publish/consume latest room signaling data (no copy/paste prompts).

4. Start gating and turn clarity
- Added explicit host-start gate before gameplay.
- Added `lobbyStart` protocol message and room-start synchronization.
- Added centralized always-visible top-center turn indicator text with active side + player identity (`You/Opponent` in online mode).
- Added formatter + tests in `dou-shou-qi/src/game/ui/turnIndicator.ts`.

5. Visual direction and responsiveness
- Updated Dou Shou Qi menu/lobby/game palette to forest style (greens/wood tones).
- Updated board styling and UI panel colors for cohesive theme.
- Enabled Phaser `Scale.FIT + autoCenter` for cleaner mobile/desktop scaling.
- Updated hub page theme/layout for consistent forest-style polish.

## Backendless architecture notes and limitations

- Core gameplay sync remains peer-to-peer WebRTC DataChannel with host authority.
- STUN-only transport remains in use; some NAT/firewall combinations can still fail.
- The shipped build loads a bundled lobby provider config from `dou-shou-qi/public/lobby-config.js` and uses it automatically unless overridden in-browser.
- You can override lobby settings in the multiplayer menu and save them per browser.
- If Firebase is not configured, local fallback lobby works only in the same browser/device context.
- Room password is casual access control, not hardened security.

## Exact play instructions (2 devices)

1. Start local server at repo root:
```bash
python3 -m http.server 8000
```

2. Open hub on both devices:
- `http://<your-host-ip>:8000/`

3. Confirm lobby provider on both devices (once):
- Open `Dou Shou Qi`.
- Verify the provider text at the bottom says `Lobby Provider: Firebase ...`.
- If needed, set a different URL in `Lobby URL` and click `Save Lobby Provider`.

4. Device A (host):
- Open `Dou Shou Qi`.
- Confirm or edit `Player Name` first (top-left field; prefilled from hub account when available).
- Optionally fill `Host Room Password (optional)`.
- Click `Host Room`.
- Wait in lobby.

5. Device B (guest):
- Open `Dou Shou Qi`.
- Confirm or edit `Player Name` first (top-left field).
- Click `Refresh Room List` in `Open Rooms`.
- If there are many rooms, use `Prev/Next` above the list to page through all open rooms.
- If target room is `[LOCK]`, enter `Join Password (if room is locked)` in the left-side field before joining.
- Click `Join` on the target room row.

6. Device A:
- After guest connects, click `Start Match`.

7. Reconnect mid-match (if disconnected):
- Host presses `Reconnect` (in match or lobby), then guest presses `Reconnect`.
- Session renegotiates with latest room version.
- Guest re-syncs to host snapshot when channel reconnects.

## Validation commands run

From repo root:
```bash
node --test tools/auth.test.mjs
node tools/validate-static-paths.mjs
```

From `dou-shou-qi/`:
```bash
npm test
npm run build
```

Note: `npm run lint` currently fails due an existing project ESLint config mismatch (ESLint v9 expects `eslint.config.*`, but this package does not include one).
