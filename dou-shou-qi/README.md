# Dou Shou Qi (斗兽棋) - Animal Chess

A traditional Chinese board game implemented with Phaser 3 and TypeScript.

## About the Game

Dou Shou Qi (斗兽棋), also known as Jungle or Animal Chess, is a classic Chinese strategy board game for two players. The game features animal pieces with different ranks that battle each other on a 7×9 board with special terrain including dens, traps, and rivers.

## Rules

### Objective
- Move any of your animals into the opponent's den to win
- Alternatively, capture all of your opponent's animals

### Game Board
- 7 columns × 9 rows
- Each player has a den in the center of their first row
- Three traps border each den
- Two river areas in the center of the board

### Animal Ranks (Strongest to Weakest)
1. Elephant (象) - Rank 8
2. Lion (狮) - Rank 7
3. Tiger (虎) - Rank 6
4. Leopard (豹) - Rank 5
5. Dog (狗) - Rank 4
6. Wolf (狼) - Rank 3
7. Cat (猫) - Rank 2
8. Mouse (鼠) - Rank 1

### Movement Rules
- All pieces move one square orthogonally (up, down, left, right)
- Pieces cannot move diagonally
- Pieces cannot move into their own den
- Pieces capture opponent's pieces of equal or lower rank

### Special Rules

**Mouse:**
- Only animal that can move on river squares
- Can capture Elephant (special rule)
- Mouse vs Mouse: can only capture if both are in the river

**Lion & Tiger:**
- Can jump over rivers horizontally or vertically
- Must land on the first non-water square on the other side
- Cannot jump if a Mouse is blocking the river
- Can capture pieces on the landing square

**Traps:**
- Any animal can capture a higher-ranked animal if the defender is in an opponent's trap

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Files Structure

```
dou-shou-qi/
├── src/
│   ├── main.ts                    # Game entry point
│   ├── core/
│   │   └── state.ts              # Game state management
│   ├── data/
│   │   ├── types.ts              # TypeScript type definitions
│   │   └── gameData.ts           # Game configuration data
│   └── game/
│       └── scenes/
│           ├── PreloadScene.ts   # Asset loading and texture generation
│           ├── MainMenuScene.ts  # Main menu
│           ├── GameScene.ts      # Main game logic
│           └── TutorialScene.ts  # How to play
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite build configuration
└── README.md                      # This file
```

## Implementation Notes

- Built with Phaser 3.90.0 and TypeScript
- Uses Vite for fast development and building
- All graphics are generated programmatically (no external assets required)
- Implements full Dou Shou Qi rules including:
  - Proper animal hierarchy
  - River traversal (Mouse only)
  - Lion/Tiger river jumping
  - Trap mechanics
  - Win conditions (reach den or eliminate all enemies)

## Controls

- Click on your animal to select it
- Click on highlighted valid move squares to move
- Reset button to restart the game
- Back button to return to main menu

## Game Features

- Turn-based two-player gameplay (pass and play)
- Visual move highlighting
- Animated piece movements
- Capture effects
- Win/lose detection
- Complete tutorial explaining rules

## Credits

Game rules based on traditional Dou Shou Qi / Jungle board game.

## License

This implementation is provided as-is for educational and entertainment purposes.