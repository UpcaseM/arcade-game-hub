# Dou Shou Qi Flip Mode (斗兽翻牌版)

Phaser 3 + TypeScript implementation of a dark-start Dou Shou Qi variant.

## Variant Summary

This project intentionally uses **flip mode** (暗棋开局), not the standard 7×9 open-board jungle chess.

- Board: 4×4
- Pieces: 16 total (blue/red each has Elephant, Lion, Tiger, Leopard, Dog, Wolf, Cat, Mouse)
- Opening: all pieces start face-down in random positions
- Side assignment: first revealed piece sets that player's color
- Turn actions: flip one hidden piece, or move one of your revealed pieces
- Move rule: one orthogonal step (no diagonal)
- Capture rule: higher rank captures lower rank; equal rank eliminates both pieces
- Special rule: Mouse can capture Elephant, Elephant cannot capture Mouse
- Hidden piece rule: hidden pieces cannot move or be captured until revealed
- Win: capture all opponent-color pieces, or opponent has no legal action

## Controls

- Click a hidden tile to flip
- Click your revealed piece to select
- Click a highlighted target to move/capture
- Back button returns to the game menu

## Online Lobby Flow

- Multiplayer uses a room-lobby model: host creates a room and enters a lobby immediately.
- Guests browse open rooms from a list and join directly (optional room password).
- Host can start the match only after a guest connects.
- Authority model: host validates actions and sends snapshots; guest applies snapshots.
- Roles: host controls `player1`, guest controls `player2`.
- Identity defaults to hub account username (`arcade_active_user_v1`) when available.
- Reconnect stays in the same room by publishing a fresh offer/answer version.
- Lobby/menu interactions use in-scene forms (no browser prompt/alert flow).

## Lobby Provider Configuration

- Default cross-device config is bundled in `public/lobby-config.js` and loaded automatically at startup.
- For a different deployment, update `databaseUrl` in `public/lobby-config.js` before building.
- Per-browser override is available from the multiplayer menu:
  - Set `Lobby URL` and optional `Lobby Auth Token`, then click `Save Lobby Provider`.
  - Click `Use Bundled Lobby Config` to remove local override.
  - Click `Use Local Lobby Only` to force same-device localStorage fallback.

### Limitations

- STUN-only (no TURN): strict NAT/firewall setups may fail to connect.
- Cross-device room listing requires a writable Firebase Realtime Database URL.
- Without Firebase config, fallback lobby uses local browser storage (same-device only).
- Room passwords are casual access control (salted hash stored client-side), not strong security.
- Client authority/security is demo-grade and not anti-cheat hardened.

## Audio MVP

- Procedural WebAudio background loop (no external files).
- SFX hooks: flip, move, capture, win.
- Settings persisted in localStorage:
  - `musicVolume`
  - `sfxVolume`
  - `musicMuted`
  - `sfxMuted`
  - `reducedMotion`
  - `colorAssist`

## Dev Commands

```bash
npm ci
npm test
npm run build
```

## Build Output

`dist/` is committed because the hub is served as a static GitHub Pages site without a CI build step.

## File Layout

- `src/data/types.ts` - core types for flip mode state
- `src/data/gameData.ts` - setup, rules, move/flip/capture/win logic
- `src/data/gameData.test.ts` - rules tests
- `src/game/scenes/GameScene.ts` - board interaction and HUD
- `src/game/scenes/MainMenuScene.ts` - mode entry
- `src/game/scenes/TutorialScene.ts` - in-game rules text
