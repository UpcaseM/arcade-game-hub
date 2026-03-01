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
- Capture rule: higher/equal rank captures lower/equal rank
- Special rule: Mouse can capture Elephant, Elephant cannot capture Mouse
- Hidden piece rule: hidden pieces cannot move or be captured until revealed
- Win: capture all opponent-color pieces, or opponent has no legal action

## Controls

- Click a hidden tile to flip
- Click your revealed piece to select
- Click a highlighted target to move/capture
- Back button returns to the game menu

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
