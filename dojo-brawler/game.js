const canvas = document.getElementById('fightCanvas');
const ctx = canvas.getContext('2d');

const playerHpFill = document.getElementById('playerHpFill');
const enemyHpFill = document.getElementById('enemyHpFill');
const playerHpText = document.getElementById('playerHpText');
const enemyHpText = document.getElementById('enemyHpText');

const resultOverlay = document.getElementById('resultOverlay');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');
const restartBtn = document.getElementById('restartBtn');
const backToHubBtn = document.getElementById('backToHubBtn');
const overlayBackBtn = document.getElementById('overlayBackBtn');

const joystickPad = document.getElementById('joystickPad');
const joystickKnob = document.getElementById('joystickKnob');
const attackBtn = document.getElementById('attackBtn');

const WORLD = {
  width: 960,
  height: 540
};

const INPUT = {
  keys: new Set(),
  joystick: { x: 0, y: 0, active: false },
  attackPressed: false,
  attackHeld: false
};

const state = {
  running: true,
  winner: null,
  player: null,
  enemy: null,
  sparks: []
};

const images = {
  bg: createImage('assets/kenney/background/bg_blue.png'),
  fighter: createImage('assets/kenney/ships/player_main.png'),
  spark: createImage('assets/kenney/effects/hit_spark.png')
};

let joystickPointerId = null;
let attackPointerId = null;
let lastTs = 0;
let accumulator = 0;
const STEP = 1 / 60;

function createImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function makeFighter({ x, y, tint, isPlayer }) {
  return {
    x,
    y,
    w: 64,
    h: 64,
    vx: 0,
    vy: 0,
    facing: isPlayer ? 1 : -1,
    speed: isPlayer ? 260 : 210,
    hp: 100,
    maxHp: 100,
    cooldown: 0,
    attackTimer: 0,
    invuln: 0,
    hitFlash: 0,
    retreatTimer: 0,
    tint,
    isPlayer,
    didHitOnAttack: false
  };
}

function resetFight() {
  state.running = true;
  state.winner = null;
  state.sparks = [];

  state.player = makeFighter({
    x: WORLD.width * 0.3,
    y: WORLD.height * 0.58,
    tint: null,
    isPlayer: true
  });

  state.enemy = makeFighter({
    x: WORLD.width * 0.7,
    y: WORLD.height * 0.58,
    tint: 'enemy',
    isPlayer: false
  });

  hideOverlay();
  updateHud();
}

function showOverlay(title, text) {
  resultTitle.textContent = title;
  resultText.textContent = text;
  resultOverlay.classList.remove('hidden');
}

function hideOverlay() {
  resultOverlay.classList.add('hidden');
}

function updateHud() {
  const playerPercent = Math.max(0, (state.player.hp / state.player.maxHp) * 100);
  const enemyPercent = Math.max(0, (state.enemy.hp / state.enemy.maxHp) * 100);

  playerHpFill.style.width = `${playerPercent.toFixed(1)}%`;
  enemyHpFill.style.width = `${enemyPercent.toFixed(1)}%`;

  playerHpText.textContent = `${Math.max(0, Math.ceil(state.player.hp))} / ${state.player.maxHp}`;
  enemyHpText.textContent = `${Math.max(0, Math.ceil(state.enemy.hp))} / ${state.enemy.maxHp}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function length(x, y) {
  return Math.hypot(x, y);
}

function normalize(x, y) {
  const len = length(x, y);
  if (!len) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

function getPlayerMoveInput() {
  const keyX = (INPUT.keys.has('arrowright') || INPUT.keys.has('d') ? 1 : 0) -
    (INPUT.keys.has('arrowleft') || INPUT.keys.has('a') ? 1 : 0);
  const keyY = (INPUT.keys.has('arrowdown') || INPUT.keys.has('s') ? 1 : 0) -
    (INPUT.keys.has('arrowup') || INPUT.keys.has('w') ? 1 : 0);

  const rawX = keyX + INPUT.joystick.x;
  const rawY = keyY + INPUT.joystick.y;

  if (Math.abs(rawX) < 0.05 && Math.abs(rawY) < 0.05) {
    return { x: 0, y: 0 };
  }

  return normalize(rawX, rawY);
}

function startAttack(fighter) {
  if (fighter.cooldown > 0 || fighter.attackTimer > 0) {
    return;
  }

  fighter.attackTimer = 0.14;
  fighter.cooldown = 0.52;
  fighter.didHitOnAttack = false;
}

function getAttackBox(fighter) {
  const reach = 58;
  const boxW = 54;
  const boxH = 46;
  const dir = fighter.facing || 1;
  const centerX = fighter.x + dir * (fighter.w * 0.48 + reach * 0.45);
  const centerY = fighter.y;

  return {
    x: centerX - boxW / 2,
    y: centerY - boxH / 2,
    w: boxW,
    h: boxH
  };
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function hurtBox(f) {
  return {
    x: f.x - f.w / 2,
    y: f.y - f.h / 2,
    w: f.w,
    h: f.h
  };
}

function applyHit(attacker, defender) {
  if (defender.invuln > 0) {
    return;
  }

  const dmg = attacker.isPlayer ? 16 : 13;
  defender.hp = Math.max(0, defender.hp - dmg);
  defender.invuln = 0.24;
  defender.hitFlash = 0.14;
  attacker.didHitOnAttack = true;

  const knock = attacker.isPlayer ? 64 : 54;
  defender.x += attacker.facing * knock;
  defender.y += attacker.isPlayer ? -8 : 6;

  state.sparks.push({
    x: defender.x - attacker.facing * 16,
    y: defender.y - 8,
    ttl: 0.18,
    size: 28
  });

  if (defender.hp <= 0) {
    state.running = false;
    state.winner = attacker.isPlayer ? 'player' : 'enemy';
    const won = state.winner === 'player';
    showOverlay(won ? 'You Win' : 'You Lose', won ? 'Great combo. Fight again?' : 'The rival got you. Rematch?');
  }
}

function separateFighters(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const overlapX = (a.w + b.w) / 2 - Math.abs(dx);
  const overlapY = (a.h + b.h) / 2 - Math.abs(dy);

  if (overlapX <= 0 || overlapY <= 0) {
    return;
  }

  if (overlapX < overlapY) {
    const push = overlapX / 2;
    const dir = dx < 0 ? -1 : 1;
    a.x -= dir * push;
    b.x += dir * push;
  } else {
    const push = overlapY / 2;
    const dir = dy < 0 ? -1 : 1;
    a.y -= dir * push;
    b.y += dir * push;
  }
}

function keepInBounds(fighter) {
  const halfW = fighter.w / 2;
  const halfH = fighter.h / 2;
  fighter.x = clamp(fighter.x, halfW, WORLD.width - halfW);
  fighter.y = clamp(fighter.y, halfH + 30, WORLD.height - halfH - 16);
}

function updateEnemyAI(dt) {
  const enemy = state.enemy;
  const player = state.player;

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = length(dx, dy);

  let moveX = 0;
  let moveY = 0;

  if (enemy.retreatTimer > 0) {
    enemy.retreatTimer -= dt;
  }

  const shouldRetreat = enemy.retreatTimer > 0 || (enemy.hp < 30 && dist < 185);

  if (shouldRetreat) {
    const away = normalize(-dx, -dy * 0.7);
    moveX = away.x;
    moveY = away.y;
  } else if (dist > 150) {
    const toward = normalize(dx, dy);
    moveX = toward.x;
    moveY = toward.y;
  } else if (dist > 92) {
    const strafe = normalize(dy, -dx);
    const toward = normalize(dx, dy);
    moveX = toward.x * 0.5 + strafe.x * 0.7;
    moveY = toward.y * 0.5 + strafe.y * 0.7;
  } else {
    moveY = dy > 0 ? 0.5 : -0.5;
  }

  const movement = normalize(moveX, moveY);
  enemy.vx = movement.x * enemy.speed;
  enemy.vy = movement.y * enemy.speed;

  if (Math.abs(enemy.vx) > 3) {
    enemy.facing = enemy.vx >= 0 ? 1 : -1;
  } else {
    enemy.facing = dx >= 0 ? 1 : -1;
  }

  const canAttack = enemy.cooldown <= 0 && enemy.attackTimer <= 0;
  const attackRange = dist < 106 && Math.abs(dy) < 52;
  if (canAttack && attackRange) {
    startAttack(enemy);
    enemy.retreatTimer = 0.28;
  }
}

function updateFighter(fighter, dt) {
  fighter.cooldown = Math.max(0, fighter.cooldown - dt);
  fighter.attackTimer = Math.max(0, fighter.attackTimer - dt);
  fighter.invuln = Math.max(0, fighter.invuln - dt);
  fighter.hitFlash = Math.max(0, fighter.hitFlash - dt);

  fighter.x += fighter.vx * dt;
  fighter.y += fighter.vy * dt;

  keepInBounds(fighter);
}

function updateSparks(dt) {
  for (let index = state.sparks.length - 1; index >= 0; index -= 1) {
    const spark = state.sparks[index];
    spark.ttl -= dt;
    spark.size += dt * 52;
    if (spark.ttl <= 0) {
      state.sparks.splice(index, 1);
    }
  }
}

function update(dt) {
  const player = state.player;
  const enemy = state.enemy;

  if (state.running) {
    const move = getPlayerMoveInput();
    player.vx = move.x * player.speed;
    player.vy = move.y * player.speed;

    if (Math.abs(player.vx) > 4) {
      player.facing = player.vx >= 0 ? 1 : -1;
    }

    const wantsAttack = INPUT.attackPressed || INPUT.attackHeld;
    if (wantsAttack) {
      startAttack(player);
    }

    updateEnemyAI(dt);
  } else {
    player.vx = 0;
    player.vy = 0;
    enemy.vx = 0;
    enemy.vy = 0;
  }

  updateFighter(player, dt);
  updateFighter(enemy, dt);

  separateFighters(player, enemy);
  keepInBounds(player);
  keepInBounds(enemy);

  if (state.running) {
    if (player.attackTimer > 0 && !player.didHitOnAttack) {
      const hitbox = getAttackBox(player);
      if (overlaps(hitbox, hurtBox(enemy))) {
        applyHit(player, enemy);
      }
    }

    if (enemy.attackTimer > 0 && !enemy.didHitOnAttack) {
      const hitbox = getAttackBox(enemy);
      if (overlaps(hitbox, hurtBox(player))) {
        applyHit(enemy, player);
      }
    }
  }

  updateSparks(dt);
  updateHud();

  INPUT.attackPressed = false;
}

function drawArena() {
  if (images.bg.complete) {
    ctx.drawImage(images.bg, 0, 0, WORLD.width, WORLD.height);
  } else {
    ctx.fillStyle = '#081427';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  ctx.fillStyle = 'rgba(5, 14, 30, 0.46)';
  ctx.fillRect(0, WORLD.height * 0.74, WORLD.width, WORLD.height * 0.26);

  ctx.strokeStyle = 'rgba(197, 221, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 38, WORLD.width - 60, WORLD.height - 78);
}

function drawFighter(fighter) {
  const bodyX = fighter.x - fighter.w / 2;
  const bodyY = fighter.y - fighter.h / 2;

  ctx.save();
  if (fighter.hitFlash > 0) {
    ctx.globalAlpha = 0.5;
  }

  if (images.fighter.complete) {
    if (fighter.tint === 'enemy') {
      ctx.filter = 'hue-rotate(170deg) saturate(1.35)';
    }
    ctx.translate(fighter.x, fighter.y);
    ctx.scale(fighter.facing, 1);
    ctx.drawImage(images.fighter, -fighter.w / 2, -fighter.h / 2, fighter.w, fighter.h);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = fighter.isPlayer ? '#43b8ff' : '#ff6d83';
    ctx.fillRect(bodyX, bodyY, fighter.w, fighter.h);
  }

  ctx.restore();

  if (fighter.attackTimer > 0) {
    const box = getAttackBox(fighter);
    ctx.fillStyle = fighter.isPlayer ? 'rgba(84, 189, 255, 0.35)' : 'rgba(255, 104, 127, 0.33)';
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
}

function drawSparks() {
  state.sparks.forEach((spark) => {
    const alpha = clamp(spark.ttl / 0.18, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (images.spark.complete) {
      ctx.drawImage(images.spark, spark.x - spark.size / 2, spark.y - spark.size / 2, spark.size, spark.size);
    } else {
      ctx.fillStyle = 'rgba(255, 215, 92, 0.85)';
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function render() {
  drawArena();
  drawFighter(state.player);
  drawFighter(state.enemy);
  drawSparks();
}

function frame(ts) {
  if (!lastTs) {
    lastTs = ts;
  }

  const delta = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  accumulator += delta;

  while (accumulator >= STEP) {
    update(STEP);
    accumulator -= STEP;
  }

  render();
  requestAnimationFrame(frame);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round((rect.width * WORLD.height / WORLD.width) * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(canvas.width / WORLD.width, canvas.height / WORLD.height);
}

function goBackToHub() {
  window.location.href = '../';
}

function setJoystickFromPointer(clientX, clientY) {
  const rect = joystickPad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const maxRadius = rect.width * 0.34;

  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(dist, maxRadius);
  const unit = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };
  const offsetX = unit.x * clampedDist;
  const offsetY = unit.y * clampedDist;

  INPUT.joystick.active = true;
  INPUT.joystick.x = offsetX / maxRadius;
  INPUT.joystick.y = offsetY / maxRadius;
  joystickKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

function resetJoystick() {
  INPUT.joystick.active = false;
  INPUT.joystick.x = 0;
  INPUT.joystick.y = 0;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
}

function initInput() {
  const preventKeys = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'spacebar']);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (preventKeys.has(key)) {
      event.preventDefault();
    }

    INPUT.keys.add(key);

    if (key === ' ' || key === 'spacebar' || key === 'j' || key === 'k') {
      INPUT.attackPressed = true;
      INPUT.attackHeld = true;
    }

    if (key === 'r' && !state.running) {
      resetFight();
    }
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    INPUT.keys.delete(key);

    if (key === ' ' || key === 'spacebar' || key === 'j' || key === 'k') {
      INPUT.attackHeld = false;
    }
  });

  joystickPad.addEventListener('pointerdown', (event) => {
    joystickPointerId = event.pointerId;
    joystickPad.setPointerCapture(event.pointerId);
    setJoystickFromPointer(event.clientX, event.clientY);
  });

  joystickPad.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointerId) {
      return;
    }
    setJoystickFromPointer(event.clientX, event.clientY);
  });

  const endJoystick = (event) => {
    if (event.pointerId !== joystickPointerId) {
      return;
    }
    joystickPointerId = null;
    resetJoystick();
  };

  joystickPad.addEventListener('pointerup', endJoystick);
  joystickPad.addEventListener('pointercancel', endJoystick);

  attackBtn.addEventListener('pointerdown', (event) => {
    attackPointerId = event.pointerId;
    attackBtn.setPointerCapture(event.pointerId);
    INPUT.attackPressed = true;
    INPUT.attackHeld = true;
  });

  const endAttack = (event) => {
    if (event.pointerId !== attackPointerId) {
      return;
    }
    attackPointerId = null;
    INPUT.attackHeld = false;
  };

  attackBtn.addEventListener('pointerup', endAttack);
  attackBtn.addEventListener('pointercancel', endAttack);

  restartBtn.addEventListener('click', () => {
    resetFight();
  });

  backToHubBtn.addEventListener('click', goBackToHub);
  overlayBackBtn.addEventListener('click', goBackToHub);

  window.addEventListener('resize', resizeCanvas);
}

initInput();
resetFight();
resizeCanvas();
requestAnimationFrame(frame);
