const STORAGE_KEYS = {
  snakeHighScore: 'arcade_snake_high_score_v2',
  tapBest: 'arcade_tap_blitz_best_v1',
  colorBest: 'arcade_color_match_best_v1'
};

const screens = {
  menu: document.getElementById('menuScreen'),
  snake: document.getElementById('snakeScreen'),
  tap: document.getElementById('tapScreen'),
  color: document.getElementById('colorScreen'),
  douShouQi: document.getElementById('douShouQiScreen')
};

const gameButtons = document.querySelectorAll('[data-open-game]');
const backButtons = document.querySelectorAll('[data-back-to-menu]');

let currentScreen = 'menu';

function getStoredNumber(key) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : 0;
}

function setStoredNumber(key, value) {
  localStorage.setItem(key, String(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showScreen(name) {
  const nextScreen = screens[name];

  if (!nextScreen) {
    return;
  }

  if (name === currentScreen) {
    return;
  }

  if (currentScreen === 'snake' && name !== 'snake') {
    pauseSnakeIfNeeded();
  }

  if (currentScreen === 'tap' && name !== 'tap' && tapRunning) {
    stopTapGame('Game paused. Press Start to play again.');
  }

  if (currentScreen === 'color' && name !== 'color' && colorRunning) {
    stopColorGame('Game paused. Press Start to play again.');
  }

  Object.values(screens).forEach(screen => {
    screen.classList.remove('screen-active');
  });

  nextScreen.classList.add('screen-active');
  currentScreen = name;

  if (name === 'douShouQi') {
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.innerHTML = ''; // Clear any existing content
      const script = document.createElement('script');
      script.src = 'dou-shou-qi/dist/main.js';
      document.head.appendChild(script);
    }
  }

    if (snakeRunning && snakePaused && !snakeGameOver) {
      toggleSnakePause(false);
    }
  }
}

gameButtons.forEach(button => {
  button.addEventListener('click', () => {
    const gameName = button.dataset.openGame;
    showScreen(gameName);
  });
});

backButtons.forEach(button => {
  button.addEventListener('click', () => {
    showScreen('menu');
  });
});

const GRID_SIZE = 20;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

const INITIAL_MOVE_DELAY = 115;
const MIN_MOVE_DELAY = 58;
const SPEED_UP_EVERY = 4;
const SPEED_STEP = 5;
const MAX_QUEUED_TURNS = 2;
const MAX_STEPS_PER_FRAME = 3;

const DIRECTION_ORDER = ['up', 'right', 'down', 'left'];
const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const snakePanel = document.querySelector('#snakeScreen .game-panel');

const boardLayerCanvas = document.createElement('canvas');
const boardLayerContext = boardLayerCanvas.getContext('2d');

const snakeScoreElement = document.getElementById('score');
const snakeHighScoreElement = document.getElementById('highScore');
const snakeSpeedElement = document.getElementById('speed');

const pauseButton = document.getElementById('pauseBtn');
const restartButton = document.getElementById('restartBtn');
const turnLeftButton = document.getElementById('turnLeftBtn');
const turnRightButton = document.getElementById('turnRightBtn');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');

let snake = [];
let snakeFood = null;
let snakeDirection = 'right';
let queuedTurns = [];

let snakeRunning = false;
let snakePaused = false;
let snakeGameOver = false;

let snakeScore = 0;
let snakeHighScore = 0;

let moveDelay = INITIAL_MOVE_DELAY;
let speedMultiplier = 1;

let lastFrameTime = 0;
let accumulatedTime = 0;

function resizeSnakeCanvas() {
  const cssSize = Math.floor(canvas.getBoundingClientRect().width);

  if (cssSize <= 0) {
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const nextSize = Math.floor(cssSize * pixelRatio);

  if (canvas.width !== nextSize || canvas.height !== nextSize) {
    canvas.width = nextSize;
    canvas.height = nextSize;
    rebuildSnakeBoardLayer();
  }
}

function rebuildSnakeBoardLayer() {
  if (!canvas.width || !canvas.height || !boardLayerContext) {
    return;
  }

  if (boardLayerCanvas.width !== canvas.width || boardLayerCanvas.height !== canvas.height) {
    boardLayerCanvas.width = canvas.width;
    boardLayerCanvas.height = canvas.height;
  }

  const boardSize = boardLayerCanvas.width;
  const cellSize = boardSize / GRID_SIZE;

  boardLayerContext.clearRect(0, 0, boardSize, boardSize);
  boardLayerContext.fillStyle = '#070f25';
  boardLayerContext.fillRect(0, 0, boardSize, boardSize);

  boardLayerContext.strokeStyle = 'rgba(173, 194, 236, 0.12)';
  boardLayerContext.lineWidth = Math.max(1, boardSize / 520);

  for (let index = 0; index <= GRID_SIZE; index += 1) {
    const offset = index * cellSize;

    boardLayerContext.beginPath();
    boardLayerContext.moveTo(offset, 0);
    boardLayerContext.lineTo(offset, boardSize);
    boardLayerContext.stroke();

    boardLayerContext.beginPath();
    boardLayerContext.moveTo(0, offset);
    boardLayerContext.lineTo(boardSize, offset);
    boardLayerContext.stroke();
  }
}

function setSnakeOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayText.textContent = message;
  overlay.classList.remove('hidden');
}

function hideSnakeOverlay() {
  overlay.classList.add('hidden');
}

function updateSnakeHud() {
  snakeScoreElement.textContent = String(snakeScore);
  snakeHighScoreElement.textContent = String(snakeHighScore);
  snakeSpeedElement.textContent = `${speedMultiplier.toFixed(1)}x`;
}

function nextDirectionFromTurn(currentDirection, turnDirection) {
  const currentIndex = DIRECTION_ORDER.indexOf(currentDirection);
  const step = turnDirection === 'left' ? -1 : 1;
  const nextIndex = (currentIndex + step + DIRECTION_ORDER.length) % DIRECTION_ORDER.length;
  return DIRECTION_ORDER[nextIndex];
}

function getRandomCell() {
  return {
    x: randomInt(0, GRID_SIZE - 1),
    y: randomInt(0, GRID_SIZE - 1)
  };
}

function createSnakeFood() {
  let nextFood = getRandomCell();

  while (snake.some(segment => segment.x === nextFood.x && segment.y === nextFood.y)) {
    nextFood = getRandomCell();
  }

  return nextFood;
}

function updateSnakeSpeed() {
  const speedLevel = Math.floor(snakeScore / SPEED_UP_EVERY);
  moveDelay = Math.max(MIN_MOVE_DELAY, INITIAL_MOVE_DELAY - speedLevel * SPEED_STEP);
  speedMultiplier = INITIAL_MOVE_DELAY / moveDelay;
}

function resetSnakeState() {
  const center = Math.floor(GRID_SIZE / 2);

  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center }
  ];

  snakeDirection = 'right';
  queuedTurns = [];
  snakeFood = createSnakeFood();

  snakeRunning = true;
  snakePaused = false;
  snakeGameOver = false;

  snakeScore = 0;
  moveDelay = INITIAL_MOVE_DELAY;
  speedMultiplier = 1;
  accumulatedTime = 0;

  pauseButton.textContent = 'Pause';
  pauseButton.disabled = false;

  hideSnakeOverlay();
  updateSnakeHud();
}

function finishSnakeGame(title, message) {
  snakeGameOver = true;
  snakeRunning = false;
  pauseButton.disabled = true;

  if (snakeScore > snakeHighScore) {
    snakeHighScore = snakeScore;
    setStoredNumber(STORAGE_KEYS.snakeHighScore, snakeHighScore);
  }

  updateSnakeHud();
  setSnakeOverlay(title, message);
}

function queueSnakeTurn(turnDirection) {
  if (!snakeRunning || snakePaused || snakeGameOver) {
    return;
  }

  if (turnDirection !== 'left' && turnDirection !== 'right') {
    return;
  }

  const lastQueuedTurn = queuedTurns[queuedTurns.length - 1];

  if (lastQueuedTurn === turnDirection) {
    return;
  }

  if (queuedTurns.length >= MAX_QUEUED_TURNS) {
    queuedTurns[queuedTurns.length - 1] = turnDirection;
    return;
  }

  queuedTurns.push(turnDirection);
}

function moveSnake() {
  if (!snakeRunning || snakePaused || snakeGameOver) {
    return;
  }

  if (queuedTurns.length > 0) {
    snakeDirection = nextDirectionFromTurn(snakeDirection, queuedTurns.shift());
  }

  const vector = DIRECTION_VECTORS[snakeDirection];
  const currentHead = snake[0];

  const nextHead = {
    x: currentHead.x + vector.x,
    y: currentHead.y + vector.y
  };

  if (nextHead.x < 0 || nextHead.x >= GRID_SIZE || nextHead.y < 0 || nextHead.y >= GRID_SIZE) {
    finishSnakeGame('Game Over', `Final score: ${snakeScore}. Press Restart to play again.`);
    return;
  }

  const willEatFood = nextHead.x === snakeFood.x && nextHead.y === snakeFood.y;
  const collisionBody = willEatFood ? snake : snake.slice(0, -1);

  const hitBody = collisionBody.some(segment => segment.x === nextHead.x && segment.y === nextHead.y);

  if (hitBody) {
    finishSnakeGame('Game Over', `Final score: ${snakeScore}. Press Restart to play again.`);
    return;
  }

  snake.unshift(nextHead);

  if (willEatFood) {
    snakeScore += 1;

    if (snakeScore > snakeHighScore) {
      snakeHighScore = snakeScore;
      setStoredNumber(STORAGE_KEYS.snakeHighScore, snakeHighScore);
    }

    updateSnakeSpeed();

    if (snake.length === TOTAL_CELLS) {
      finishSnakeGame('Perfect Run!', `You filled the board with a score of ${snakeScore}.`);
      return;
    }

    snakeFood = createSnakeFood();
  } else {
    snake.pop();
  }

  updateSnakeHud();
}

function drawSnakeBoard() {
  if (boardLayerCanvas.width !== canvas.width || boardLayerCanvas.height !== canvas.height) {
    rebuildSnakeBoardLayer();
  }

  if (boardLayerCanvas.width && boardLayerCanvas.height) {
    ctx.drawImage(boardLayerCanvas, 0, 0);
  }
}

function drawSnakeFood() {
  const cellSize = canvas.width / GRID_SIZE;
  const centerX = snakeFood.x * cellSize + cellSize / 2;
  const centerY = snakeFood.y * cellSize + cellSize / 2;
  const radius = cellSize * 0.32;

  ctx.fillStyle = '#ff5f67';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnakeBody() {
  const cellSize = canvas.width / GRID_SIZE;
  const inset = Math.max(1.5, cellSize * 0.1);

  snake.forEach((segment, index) => {
    const x = segment.x * cellSize;
    const y = segment.y * cellSize;
    const isHead = index === 0;

    ctx.fillStyle = isHead ? '#35e57d' : '#2bc96f';
    ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);

    if (isHead) {
      const eyeSize = Math.max(2.4, cellSize * 0.16);

      ctx.fillStyle = '#ecf8ff';

      if (snakeDirection === 'up' || snakeDirection === 'down') {
        ctx.fillRect(x + cellSize * 0.26, y + cellSize * 0.24, eyeSize, eyeSize);
        ctx.fillRect(x + cellSize * 0.58, y + cellSize * 0.24, eyeSize, eyeSize);
      } else {
        ctx.fillRect(x + cellSize * 0.24, y + cellSize * 0.26, eyeSize, eyeSize);
        ctx.fillRect(x + cellSize * 0.24, y + cellSize * 0.58, eyeSize, eyeSize);
      }
    }
  });
}

function renderSnake() {
  if (!canvas.width || !canvas.height) {
    resizeSnakeCanvas();
  }

  drawSnakeBoard();
  drawSnakeFood();
  drawSnakeBody();
}

function snakeGameLoop(timestamp) {
  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const elapsed = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  if (snakeRunning && !snakePaused && !snakeGameOver) {
    accumulatedTime += clamp(elapsed, 0, 120);
    let steppedFrames = 0;

    while (accumulatedTime >= moveDelay && steppedFrames < MAX_STEPS_PER_FRAME) {
      moveSnake();
      accumulatedTime -= moveDelay;
      steppedFrames += 1;

      if (snakeGameOver) {
        break;
      }
    }

    if (steppedFrames === MAX_STEPS_PER_FRAME && accumulatedTime > moveDelay) {
      accumulatedTime = moveDelay * 0.5;
    }
  }

  renderSnake();
  requestAnimationFrame(snakeGameLoop);
}

function toggleSnakePause(forcePause = null) {
  if (!snakeRunning || snakeGameOver) {
    return;
  }

  snakePaused = forcePause ?? !snakePaused;
  pauseButton.textContent = snakePaused ? 'Resume' : 'Pause';

  if (snakePaused) {
    setSnakeOverlay('Paused', 'Press Resume to continue.');
  } else {
    hideSnakeOverlay();
  }
}

function pauseSnakeIfNeeded() {
  if (snakeRunning && !snakePaused && !snakeGameOver) {
    toggleSnakePause(true);
  }
}

function setupSnakeResizeTracking() {
  if (!snakePanel || typeof ResizeObserver !== 'function') {
    return;
  }

  const resizeObserver = new ResizeObserver(() => {
    if (currentScreen === 'snake') {
      resizeSnakeCanvas();
    }
  });

  resizeObserver.observe(snakePanel);
}

function bindInstantButton(button, handler) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    handler();
  });

  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  });
}

bindInstantButton(turnLeftButton, () => queueSnakeTurn('left'));
bindInstantButton(turnRightButton, () => queueSnakeTurn('right'));

pauseButton.addEventListener('click', () => {
  toggleSnakePause();
});

restartButton.addEventListener('click', () => {
  resetSnakeState();
  resizeSnakeCanvas();
});

window.addEventListener('resize', () => {
  if (currentScreen === 'snake') {
    resizeSnakeCanvas();
  }
});

window.addEventListener('blur', () => {
  if (currentScreen === 'snake') {
    pauseSnakeIfNeeded();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentScreen === 'snake') {
    pauseSnakeIfNeeded();
  }
});

document.addEventListener('keydown', event => {
  if (currentScreen !== 'snake') {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === 'arrowleft' || key === 'a') {
    event.preventDefault();
    queueSnakeTurn('left');
    return;
  }

  if (key === 'arrowright' || key === 'd') {
    event.preventDefault();
    queueSnakeTurn('right');
    return;
  }

  if (key === ' ') {
    event.preventDefault();
    toggleSnakePause();
  }
});

const TAP_DURATION = 20;

const tapScoreElement = document.getElementById('tapScore');
const tapBestElement = document.getElementById('tapBest');
const tapTimeElement = document.getElementById('tapTime');

const tapArena = document.getElementById('tapArena');
const tapTarget = document.getElementById('tapTarget');
const tapOverlay = document.getElementById('tapOverlay');

const tapStartButton = document.getElementById('tapStartBtn');
const tapResetButton = document.getElementById('tapResetBtn');

let tapScore = 0;
let tapBest = 0;
let tapTimeLeft = TAP_DURATION;
let tapRunning = false;
let tapTimerId = null;

function updateTapHud() {
  tapScoreElement.textContent = String(tapScore);
  tapBestElement.textContent = String(tapBest);
  tapTimeElement.textContent = `${tapTimeLeft.toFixed(1)}s`;
}

function moveTapTarget() {
  const size = randomInt(44, 72);
  const maxX = Math.max(0, tapArena.clientWidth - size - 8);
  const maxY = Math.max(0, tapArena.clientHeight - size - 8);

  tapTarget.style.width = `${size}px`;
  tapTarget.style.height = `${size}px`;
  tapTarget.style.transform = `translate(${randomInt(4, maxX + 4)}px, ${randomInt(4, maxY + 4)}px)`;
}

function stopTapGame(message = null) {
  if (!tapRunning && !message) {
    return;
  }

  clearInterval(tapTimerId);
  tapTimerId = null;
  tapRunning = false;
  tapTarget.classList.add('hidden');

  if (message) {
    tapOverlay.textContent = message;
    tapOverlay.classList.remove('hidden');
    return;
  }

  tapOverlay.textContent = `Time! You scored ${tapScore}. Press Start to play again.`;
  tapOverlay.classList.remove('hidden');
}

function startTapGame() {
  tapScore = 0;
  tapTimeLeft = TAP_DURATION;
  tapRunning = true;

  tapOverlay.classList.add('hidden');
  tapTarget.classList.remove('hidden');

  updateTapHud();
  moveTapTarget();

  clearInterval(tapTimerId);
  tapTimerId = setInterval(() => {
    tapTimeLeft = Math.max(0, tapTimeLeft - 0.1);
    updateTapHud();

    if (tapTimeLeft <= 0) {
      stopTapGame();
    }
  }, 100);
}

function resetTapGame() {
  stopTapGame('Press Start to begin.');
  tapScore = 0;
  tapTimeLeft = TAP_DURATION;
  updateTapHud();
}

bindInstantButton(tapTarget, () => {
  if (!tapRunning) {
    return;
  }

  tapScore += 1;

  if (tapScore > tapBest) {
    tapBest = tapScore;
    setStoredNumber(STORAGE_KEYS.tapBest, tapBest);
  }

  moveTapTarget();
  updateTapHud();
});

tapStartButton.addEventListener('click', () => {
  startTapGame();
});

tapResetButton.addEventListener('click', () => {
  resetTapGame();
});

const COLOR_DURATION = 25;
const COLOR_SET = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Cyan', hex: '#06b6d4' }
];

const colorScoreElement = document.getElementById('colorScore');
const colorBestElement = document.getElementById('colorBest');
const colorTimeElement = document.getElementById('colorTime');
const colorWordElement = document.getElementById('colorWord');
const colorFeedbackElement = document.getElementById('colorFeedback');

const colorMatchButton = document.getElementById('matchBtn');
const colorMismatchButton = document.getElementById('mismatchBtn');
const colorStartButton = document.getElementById('colorStartBtn');
const colorResetButton = document.getElementById('colorResetBtn');

let colorScore = 0;
let colorBest = 0;
let colorTimeLeft = COLOR_DURATION;
let colorRunning = false;
let colorRoundMatches = false;
let colorRoundLocked = false;
let colorTimerId = null;

function updateColorHud() {
  colorScoreElement.textContent = String(colorScore);
  colorBestElement.textContent = String(colorBest);
  colorTimeElement.textContent = `${colorTimeLeft.toFixed(1)}s`;
}

function getRandomColor(excludeName = null) {
  let color = COLOR_SET[randomInt(0, COLOR_SET.length - 1)];

  if (excludeName) {
    while (color.name === excludeName) {
      color = COLOR_SET[randomInt(0, COLOR_SET.length - 1)];
    }
  }

  return color;
}

function setColorFeedback(message, tone = null) {
  colorFeedbackElement.textContent = message;
  colorFeedbackElement.classList.remove('good', 'bad');

  if (tone) {
    colorFeedbackElement.classList.add(tone);
  }
}

function nextColorRound() {
  const inkColor = getRandomColor();
  const shouldMatch = Math.random() > 0.5;
  const wordColor = shouldMatch ? inkColor : getRandomColor(inkColor.name);

  colorRoundMatches = shouldMatch;
  colorWordElement.textContent = wordColor.name;
  colorWordElement.style.color = inkColor.hex;
}

function stopColorGame(message = null) {
  if (!colorRunning && !message) {
    return;
  }

  clearInterval(colorTimerId);
  colorTimerId = null;
  colorRunning = false;
  colorRoundLocked = false;

  if (message) {
    setColorFeedback(message);
    return;
  }

  setColorFeedback(`Time! You scored ${colorScore}. Press Start to play again.`);
}

function startColorGame() {
  colorScore = 0;
  colorTimeLeft = COLOR_DURATION;
  colorRoundLocked = false;
  colorRunning = true;

  setColorFeedback('Go! Match or mismatch as fast as you can.');
  nextColorRound();
  updateColorHud();

  clearInterval(colorTimerId);
  colorTimerId = setInterval(() => {
    colorTimeLeft = Math.max(0, colorTimeLeft - 0.1);
    updateColorHud();

    if (colorTimeLeft <= 0) {
      stopColorGame();
    }
  }, 100);
}

function resetColorGame() {
  stopColorGame('Press Start to begin.');
  colorScore = 0;
  colorTimeLeft = COLOR_DURATION;
  colorWordElement.textContent = 'Blue';
  colorWordElement.style.color = '#3b82f6';
  updateColorHud();
}

function submitColorAnswer(thinksMatch) {
  if (!colorRunning || colorRoundLocked) {
    return;
  }

  colorRoundLocked = true;
  const isCorrect = thinksMatch === colorRoundMatches;

  if (isCorrect) {
    colorScore += 1;
    setColorFeedback('Nice! Keep moving.', 'good');
  } else {
    colorScore = Math.max(0, colorScore - 1);
    setColorFeedback('Not quite. Stay sharp.', 'bad');
  }

  if (colorScore > colorBest) {
    colorBest = colorScore;
    setStoredNumber(STORAGE_KEYS.colorBest, colorBest);
  }

  updateColorHud();

  window.setTimeout(() => {
    if (colorRunning) {
      nextColorRound();
    }

    colorRoundLocked = false;
  }, 140);
}

colorMatchButton.addEventListener('click', () => {
  submitColorAnswer(true);
});

colorMismatchButton.addEventListener('click', () => {
  submitColorAnswer(false);
});

colorStartButton.addEventListener('click', () => {
  startColorGame();
});

colorResetButton.addEventListener('click', () => {
  resetColorGame();
});

function init() {
  snakeHighScore = getStoredNumber(STORAGE_KEYS.snakeHighScore);
  tapBest = getStoredNumber(STORAGE_KEYS.tapBest);
  colorBest = getStoredNumber(STORAGE_KEYS.colorBest);

  resetSnakeState();
  toggleSnakePause(true);

  resetTapGame();
  resetColorGame();

  updateSnakeHud();
  updateTapHud();
  updateColorHud();

  showScreen('menu');
  setupSnakeResizeTracking();
  requestAnimationFrame(snakeGameLoop);
}

init();
