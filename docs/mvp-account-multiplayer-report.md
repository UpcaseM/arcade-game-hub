# MVP Account + Multiplayer Delivery Report

## Implemented

1. Hub account/auth/admin:
- Added `auth.js` local auth service with:
  - versioned local store
  - seeded default admin (`admin` / `admin123`)
  - PBKDF2-SHA256 salted password hashing (no plaintext password storage)
  - persisted login session and active user identity mirror
- Added hub login/logout UI and admin modal UI in `index.html`, `styles.css`, `script.js`.
- Added admin CRUD actions:
  - create/update/delete users (`username`, `password`, `role`)
  - last-admin guard for delete/demote.
- Added auth docs: `docs/auth-mvp.md`.
- Added regression tests: `tools/auth.test.mjs`.

2. Dou Shou Qi online MVP:
- Added net protocol + authority helpers:
  - `dou-shou-qi/src/net/protocol.ts`
  - `dou-shou-qi/src/net/protocol.test.ts`
- Added backendless transport:
  - `dou-shou-qi/src/net/webrtcTransport.ts` (manual offer/answer signaling)
  - `dou-shou-qi/src/net/onlineSession.ts` (session lifecycle, hello identity, messaging)
- Menu online flows (`Host Online Room`, `Join Online Room`) with manual copy/paste signaling.
- Host-authoritative state handling in `GameScene`:
  - remote action requests validated by host
  - action acceptance/rejection messaging
  - host state snapshots broadcast; guest applies snapshots
  - clear identity/status line (self/opponent/host/guest).
- In-match reconnect resume:
  - added reconnect flow directly in active match (`Reconnect` button in `GameScene`)
  - host/guest perform manual re-signaling without leaving the current match scene
  - host auto-sends a fresh snapshot every time connection becomes `connected` (initial connect and reconnect), so guest resumes from authoritative state.

3. Audio settings + SFX/BGM:
- Added procedural audio engine:
  - `dou-shou-qi/src/game/audio/AudioEngine.ts`
- Added SFX events for flip/move/capture/win and persistent audio settings.
- Expanded settings model to include:
  - `musicVolume`, `sfxVolume`, `musicMuted`, `sfxMuted`.
- Added in-match settings overlay (no match exit required) with live audio controls:
  - `Music Mute`, `SFX Mute`, `Music Vol`, `SFX Vol`
  - applies immediately through `AudioEngine` and persists via `UiSettings`.

4. HUD/layout + polish:
- Refactored Dou Shou Qi HUD to a compact top-bar style (`HudView` rewrite).
- Improved board visuals (background/tiles/outline) and retained transition/feedback FX.

5. Validation/build/deploy readiness:
- Updated committed `dou-shou-qi/dist/main.js`.
- Verified static path safety remains green.

## Deferred / Known Limitations

1. Online signaling UX:
- Uses prompts for copy/paste offer/answer, not a rich in-canvas form or QR flow.

2. Reconnect robustness:
- Manual reconnect resume is supported in-match, but there is still no fully automatic reconnect or TURN-based reliability across restrictive NAT/firewall environments.

3. Security:
- Auth is explicitly demo-grade local auth only; no backend trust model.

4. NAT traversal:
- STUN-only, no TURN relay; some mobile networks will fail to connect peer-to-peer.

## Exact Play Instructions

1. Start a static server at repo root:
```bash
python3 -m http.server 8000
```

2. Open hub:
- `http://localhost:8000/`

3. Login/admin:
- Click `Login`, sign in as `admin` / `admin123`.
- Click `Admin` to create/update/delete users.

4. Dou Shou Qi online on 2 devices:
- Device A: open Dou Shou Qi -> `Host Online Room`.
- Copy OFFER code and send to Device B.
- Device B: `Join Online Room`, paste OFFER, copy generated ANSWER back to Device A.
- Device A: paste ANSWER to complete connection.
- Start playing; host is `player1`, joiner is `player2`.
- If disconnected mid-match:
  - Host taps `Reconnect`, shares the RECONNECT OFFER, then pastes guest RECONNECT ANSWER.
  - Guest taps `Reconnect`, pastes host RECONNECT OFFER, returns the generated RECONNECT ANSWER.
  - After channel reopens, guest auto-resyncs from host snapshot (same match continues).

5. In-match audio settings:
- During a match, tap `Settings` (top-right).
- Adjust music/SFX mute and volumes without leaving the game.

## Exact Test/Build Commands

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
