# Arcade Game Hub (HTML, CSS, JavaScript)

A modern browser-based game hub built with plain HTML, CSS, and JavaScript.

## Features

- Modern main menu with multiple game options
- **Snake Turbo** with responsive timing and left/right turn controls
- **Tap Blitz** reaction mini-game
- **Color Match** rapid brain challenge
- **Alien Arena** top-down survival shooter with:
  - Level select + mission unlock progression
  - Wave scheduler with multiple enemy archetypes
  - Player leveling and 3-choice upgrades
  - Weapon instances, attachment slots, and stat modifiers
  - Loot drops, inventory, crafting, and local save data
- Best-score persistence via `localStorage`
- Responsive layout optimized for desktop and touch devices

## Project Structure

- `index.html` - app structure
- `styles.css` - UI styling
- `script.js` - game logic and controls
- `alien-arena/index.html` - Alien Arena page
- `alien-arena/styles.css` - Alien Arena UI styles
- `alien-arena/main.js` - Alien Arena bootstrap
- `alien-arena/js/data.js` - data-driven game config (levels/weapons/enemies/upgrades/crafting)
- `alien-arena/js/save.js` - local save service
- `alien-arena/js/game.js` - Alien Arena core gameplay loop and systems

## Run Locally

Because this is a static app, you can run it directly:

1. Open `index.html` in your browser.

Or serve it via a local web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

Open:
- Hub: `http://localhost:8000/`
- Alien Arena direct: `http://localhost:8000/alien-arena/`

## Deployment Options

This project has no backend and no build step, so it can be deployed to any static host.

### Option 1: GitHub Pages

1. Create a new GitHub repository and push these files.
2. In the GitHub repository, go to **Settings → Pages**.
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or `master`), folder `/ (root)`
4. Save, then wait for deployment.
5. Your game will be available at:
   - `https://<your-username>.github.io/<your-repo-name>/`

### Option 2: Netlify Drop (Fastest)

1. Go to `https://app.netlify.com/drop`.
2. Drag and drop the project folder.
3. Netlify deploys instantly and gives you a public URL.

### Option 3: Vercel

1. Push the project to GitHub.
2. Import the repo at `https://vercel.com/new`.
3. Keep defaults (Framework: Other / static site).
4. Click **Deploy**.

## Customization Tips

- Snake board size: update `GRID_SIZE` in `script.js`.
- Snake speed: tweak `INITIAL_MOVE_DELAY`, `MIN_MOVE_DELAY`, and `SPEED_STEP`.
- Tap Blitz duration: adjust `TAP_DURATION`.
- Color Match duration: adjust `COLOR_DURATION`.
- Alien Arena tuning:
  - Weapons/enemies/levels/upgrades/recipes are in `alien-arena/js/data.js`
  - Save schema and reset behavior are in `alien-arena/js/save.js`
  - Debug keys in mission: `F2` (+XP), `F3` (+loot)
- Colors/theme: adjust CSS variables in `styles.css`.
