import {
  COLS,
  ROWS,
  BLOCK_SIZE,
  TETRIMINOS,
  COLORS,
  KICK_DATA_NORMAL,
  KICK_DATA_I
} from './constants.js';
import { sounds } from './sound.js';
import { Particle } from './particle.js';

// --- TETRIS GAME CLASS ---
export class Game {
  constructor() {
    // Canvas elements
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.holdCanvas = document.getElementById('hold-canvas');
    this.holdCtx = this.holdCanvas.getContext('2d');
    this.nextCanvas = document.getElementById('next-canvas');
    this.nextCtx = this.nextCanvas.getContext('2d');

    // UI elements
    this.scoreEl = document.getElementById('score');
    this.levelEl = document.getElementById('level');
    this.linesEl = document.getElementById('lines');
    
    // Screens
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.finalScoreEl = document.getElementById('final-score');
    this.boardWrapper = document.getElementById('board-wrapper');

    // Game variables
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.gameOver = false;
    this.paused = false;
    this.playing = false;

    // Piece control
    this.bag = [];
    this.nextQueue = [];
    this.activePiece = null;
    this.holdPiece = null;
    this.canHold = true;

    // Animation & Timing
    this.lastTime = 0;
    this.dropCounter = 0;
    this.dropInterval = 1000; // Gravity delay in ms
    this.lockDelayCounter = 0;
    this.lockDelayLimit = 500; // 500ms grace period on ground
    this.lockMovesCount = 0;
    this.lockMovesLimit = 15; // Limit infinite resets of lock delay

    // Effects
    this.particles = [];
    this.clearingLines = []; // Indices of lines flashing to clear
    this.clearFlashTimer = 0;

    // Bind event listeners
    this.setupListeners();
  }

  // Refill bag of 7 tetriminos (shuffled bag randomizer)
  refillBag() {
    const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    // Fisher-Yates shuffle
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.bag = this.bag.concat(pieces);
  }

  // Get next tetromino from queue
  getNextPiece() {
    while (this.nextQueue.length < 5) {
      if (this.bag.length === 0) {
        this.refillBag();
      }
      this.nextQueue.push(this.bag.shift());
    }
    return this.nextQueue.shift();
  }

  // Start a new game
  start() {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.gameOver = false;
    this.paused = false;
    this.playing = true;
    this.bag = [];
    this.nextQueue = [];
    this.holdPiece = null;
    this.canHold = true;
    this.particles = [];
    this.clearingLines = [];
    this.clearFlashTimer = 0;

    this.updateStats();
    
    // Load next pieces queue
    this.spawnPiece();

    // Visual wrapper glow
    this.boardWrapper.classList.add('active');

    // Hide overlays
    this.startScreen.classList.remove('visible');
    this.pauseScreen.classList.remove('visible');
    this.gameoverScreen.classList.remove('visible');

    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  // Spawn the active piece
  spawnPiece() {
    const nextType = this.getNextPiece();
    this.activePiece = {
      type: nextType,
      matrix: JSON.parse(JSON.stringify(TETRIMINOS[nextType].matrix)),
      colorId: TETRIMINOS[nextType].colorId,
      x: Math.floor((COLS - TETRIMINOS[nextType].matrix[0].length) / 2),
      y: nextType === 'I' ? -1 : 0,
      rotationState: 0
    };

    // Check immediate collision at spawn
    if (this.checkCollision(this.activePiece.x, this.activePiece.y, this.activePiece.matrix)) {
      this.endGame();
    }

    this.canHold = true;
    this.lockMovesCount = 0;
    this.updateDropInterval();
    this.drawHold();
    this.drawNext();
  }

  // Collision detection
  checkCollision(xOffset, yOffset, matrix) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const gridX = xOffset + c;
          const gridY = yOffset + r;

          // Check walls/floor limits
          if (gridX < 0 || gridX >= COLS || gridY >= ROWS) {
            return true;
          }

          // Check ceiling (only allow rotation or pieces above grid as long as they don't hit filled blocks)
          if (gridY >= 0) {
            if (this.board[gridY][gridX] !== 0) {
              return true;
            }
          } else if (gridY < -2) {
            // Hard bound for far out of screen ceiling
            return true;
          }
        }
      }
    }
    return false;
  }

  // Move active piece left or right
  move(dir) {
    if (this.paused || this.gameOver || !this.playing || this.clearingLines.length > 0) return;
    
    if (!this.checkCollision(this.activePiece.x + dir, this.activePiece.y, this.activePiece.matrix)) {
      this.activePiece.x += dir;
      sounds.playMove();
      this.resetLockDelay();
    }
  }

  // Rotate active piece (Super Rotation System wall kick support)
  rotate(clockwise = true) {
    if (this.paused || this.gameOver || !this.playing || this.clearingLines.length > 0) return;
    if (this.activePiece.type === 'O') return; // O-piece does not rotate

    const startState = this.activePiece.rotationState;
    const endState = (startState + (clockwise ? 1 : 3)) % 4;

    // Perform matrix rotation
    const originalMatrix = this.activePiece.matrix;
    const rotatedMatrix = clockwise 
      ? this.rotateMatrixCW(originalMatrix) 
      : this.rotateMatrixCCW(originalMatrix);

    // Get transition kicks
    const key = `${startState}->${endState}`;
    const kicks = this.activePiece.type === 'I' ? KICK_DATA_I[key] : KICK_DATA_NORMAL[key];

    // Try kick translations
    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      if (!this.checkCollision(this.activePiece.x + dx, this.activePiece.y + dy, rotatedMatrix)) {
        // Successful rotation
        this.activePiece.matrix = rotatedMatrix;
        this.activePiece.x += dx;
        this.activePiece.y += dy;
        this.activePiece.rotationState = endState;
        sounds.playRotate();
        this.resetLockDelay();
        return;
      }
    }
  }

  rotateMatrixCW(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[c][n - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  rotateMatrixCCW(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[n - 1 - c][r] = matrix[r][c];
      }
    }
    return result;
  }

  // Reset lock delay (allowing moves/rotations on ground to postpone locking)
  resetLockDelay() {
    if (this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.matrix)) {
      if (this.lockMovesCount < this.lockMovesLimit) {
        this.lockDelayCounter = 0;
        this.lockMovesCount++;
      }
    }
  }

  // Soft drop (downwards gravity)
  softDrop() {
    if (this.paused || this.gameOver || !this.playing || this.clearingLines.length > 0) return;
    
    if (!this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.matrix)) {
      this.activePiece.y++;
      this.score += 1;
      this.updateStats();
      this.dropCounter = 0; // Reset gravity drop counter
      sounds.playMove();
    }
  }

  // Hard drop (instantly drop to floor)
  hardDrop() {
    if (this.paused || this.gameOver || !this.playing || this.clearingLines.length > 0) return;
    
    let dropDistance = 0;
    while (!this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.matrix)) {
      this.activePiece.y++;
      dropDistance++;
    }
    
    this.score += dropDistance * 2;
    sounds.playDrop();
    this.lockPiece();
  }

  // Hold feature
  hold() {
    if (this.paused || this.gameOver || !this.playing || this.clearingLines.length > 0 || !this.canHold) return;

    sounds.playHold();
    const currentType = this.activePiece.type;

    if (this.holdPiece === null) {
      this.holdPiece = currentType;
      this.spawnPiece();
    } else {
      const prevHold = this.holdPiece;
      this.holdPiece = currentType;
      this.activePiece = {
        type: prevHold,
        matrix: JSON.parse(JSON.stringify(TETRIMINOS[prevHold].matrix)),
        colorId: TETRIMINOS[prevHold].colorId,
        x: Math.floor((COLS - TETRIMINOS[prevHold].matrix[0].length) / 2),
        y: prevHold === 'I' ? -1 : 0,
        rotationState: 0
      };
      this.lockMovesCount = 0;
      this.canHold = false;
      this.updateDropInterval();
      this.drawHold();
      this.drawNext();
    }
  }

  // Lock the piece on grid
  lockPiece() {
    for (let r = 0; r < this.activePiece.matrix.length; r++) {
      for (let c = 0; c < this.activePiece.matrix[r].length; c++) {
        if (this.activePiece.matrix[r][c] !== 0) {
          const gridX = this.activePiece.x + c;
          const gridY = this.activePiece.y + r;
          
          if (gridY >= 0) {
            this.board[gridY][gridX] = this.activePiece.colorId;
          } else {
            // Locked out of bounds = Game Over
            this.endGame();
            return;
          }
        }
      }
    }

    this.checkLines();
  }

  // Check and clear completed lines
  checkLines() {
    let linesToClear = [];
    
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every(val => val !== 0)) {
        linesToClear.push(r);
      }
    }

    if (linesToClear.length > 0) {
      this.clearingLines = linesToClear;
      this.clearFlashTimer = 150; // Flash duration in milliseconds
      
      // Spawn line clear sparks/particles
      linesToClear.forEach(rowY => {
        for (let colX = 0; colX < COLS; colX++) {
          const colorId = this.board[rowY][colX];
          const colorHex = COLORS[colorId] ? COLORS[colorId].main : '#fff';
          // 5 particles per cell
          for (let p = 0; p < 5; p++) {
            this.particles.push(new Particle(
              colX * BLOCK_SIZE + BLOCK_SIZE / 2,
              rowY * BLOCK_SIZE + BLOCK_SIZE / 2,
              colorHex
            ));
          }
        }
      });

      sounds.playLineClear(linesToClear.length);
    } else {
      this.spawnPiece();
    }
  }

  // Finalize cleared lines, calculate score, apply gravity
  finalizeLineClears() {
    const linesClearedThisTurn = this.clearingLines.length;
    
    // Score formulas
    const scoreMap = [0, 100, 300, 500, 800];
    this.score += (scoreMap[linesClearedThisTurn] || 0) * this.level;
    this.lines += linesClearedThisTurn;

    // Check level progression
    const newLevel = Math.floor(this.lines / 10) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      sounds.playLevelUp();
    }

    // Collapse board rows
    this.clearingLines.forEach(rowIdx => {
      this.board.splice(rowIdx, 1);
      this.board.unshift(Array(COLS).fill(0));
    });

    this.clearingLines = [];
    this.updateStats();
    this.spawnPiece();
  }

  updateDropInterval() {
    // Level formula for dropping speed
    this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 75);
  }

  updateStats() {
    this.scoreEl.innerText = String(this.score).padStart(6, '0');
    this.levelEl.innerText = this.level;
    this.linesEl.innerText = this.lines;
  }

  // Pause toggle
  togglePause() {
    if (this.gameOver || !this.playing) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseScreen.classList.add('visible');
    } else {
      this.pauseScreen.classList.remove('visible');
      this.lastTime = performance.now();
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  endGame() {
    this.gameOver = true;
    this.playing = false;
    this.boardWrapper.classList.remove('active');
    this.finalScoreEl.innerText = this.score;
    this.gameoverScreen.classList.add('visible');
    sounds.playGameOver();
  }

  // Get active piece landing ghost position
  getGhostY() {
    if (!this.activePiece) return 0;
    let ghostY = this.activePiece.y;
    while (!this.checkCollision(this.activePiece.x, ghostY + 1, this.activePiece.matrix)) {
      ghostY++;
    }
    return ghostY;
  }

  // --- DRAWING / RENDERING STYLES ---
  drawBlock(ctx, x, y, colorId, size, isGhost = false, isFlash = false) {
    const rx = x * size;
    const ry = y * size;
    const radius = 6;

    ctx.save();
    
    if (isFlash) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffffff';
      this.drawRoundedRect(ctx, rx + 1, ry + 1, size - 2, size - 2, radius);
      ctx.fill();
      ctx.restore();
      return;
    }

    const color = COLORS[colorId];
    if (!color) {
      ctx.restore();
      return;
    }

    if (isGhost) {
      ctx.strokeStyle = color.main;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      this.drawRoundedRect(ctx, rx + 1, ry + 1, size - 2, size - 2, radius);
      ctx.fill();
      ctx.stroke();
    } else {
      // Glow shadow (slightly transparent)
      ctx.shadowColor = color.shadow;
      ctx.shadowBlur = 10;

      // Diagonal gradient to add sleek 3D neon feeling
      const grad = ctx.createLinearGradient(rx, ry, rx + size, ry + size);
      grad.addColorStop(0, color.main);
      grad.addColorStop(1, color.fill);

      ctx.fillStyle = grad;
      this.drawRoundedRect(ctx, rx + 1, ry + 1, size - 2, size - 2, radius);
      ctx.fill();

      // Top-Left gloss line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry + 3);
      ctx.lineTo(rx + size - radius, ry + 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawRoundedRect(ctx, x, y, width, height, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;
    
    // Draw columns
    for (let c = 0; c <= COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * BLOCK_SIZE, 0);
      this.ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      this.ctx.stroke();
    }
    
    // Draw rows
    for (let r = 0; r <= ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * BLOCK_SIZE);
      this.ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      this.ctx.stroke();
    }
  }

  drawBoard() {
    // Render static grid blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.board[r][c] !== 0) {
          const isFlashed = this.clearingLines.includes(r);
          this.drawBlock(this.ctx, c, r, this.board[r][c], BLOCK_SIZE, false, isFlashed);
        }
      }
    }
  }

  drawActivePiece() {
    if (!this.activePiece) return;

    // Draw ghost projection first
    const ghostY = this.getGhostY();
    for (let r = 0; r < this.activePiece.matrix.length; r++) {
      for (let c = 0; c < this.activePiece.matrix[r].length; c++) {
        if (this.activePiece.matrix[r][c] !== 0) {
          const gridY = ghostY + r;
          if (gridY >= 0) {
            this.drawBlock(this.ctx, this.activePiece.x + c, gridY, this.activePiece.colorId, BLOCK_SIZE, true);
          }
        }
      }
    }

    // Draw main active piece
    for (let r = 0; r < this.activePiece.matrix.length; r++) {
      for (let c = 0; c < this.activePiece.matrix[r].length; c++) {
        if (this.activePiece.matrix[r][c] !== 0) {
          const gridY = this.activePiece.y + r;
          if (gridY >= 0) {
            this.drawBlock(this.ctx, this.activePiece.x + c, gridY, this.activePiece.colorId, BLOCK_SIZE, false);
          }
        }
      }
    }
  }

  drawHold() {
    this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    if (this.holdPiece === null) return;

    const matrix = TETRIMINOS[this.holdPiece].matrix;
    const colorId = TETRIMINOS[this.holdPiece].colorId;
    const cellSize = 22;

    // Center matrix calculations
    const mx = (this.holdCanvas.width - matrix[0].length * cellSize) / 2;
    const my = (this.holdCanvas.height - matrix.length * cellSize) / 2;

    this.holdCtx.save();
    this.holdCtx.translate(mx, my);
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          this.drawBlock(this.holdCtx, c, r, colorId, cellSize, false);
        }
      }
    }
    this.holdCtx.restore();
  }

  drawNext() {
    this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    const cellSize = 18;
    const padding = 20;

    // Draw the next 3 pieces
    for (let i = 0; i < 3; i++) {
      const type = this.nextQueue[i];
      if (!type) continue;

      const matrix = TETRIMINOS[type].matrix;
      const colorId = TETRIMINOS[type].colorId;

      // Centers width, layout height stacking
      const mx = (this.nextCanvas.width - matrix[0].length * cellSize) / 2;
      const my = padding + i * 85 + (4 - matrix.length) * (cellSize / 2);

      this.nextCtx.save();
      this.nextCtx.translate(mx, my);
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            this.drawBlock(this.nextCtx, c, r, colorId, cellSize, false);
          }
        }
      }
      this.nextCtx.restore();
    }
  }

  // --- GAME MAIN LOOP ---
  gameLoop(time) {
    if (this.paused || this.gameOver || !this.playing) return;

    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background grid lines
    this.drawGrid();

    // Check if handling clear flash animations
    if (this.clearingLines.length > 0) {
      this.clearFlashTimer -= deltaTime;
      if (this.clearFlashTimer <= 0) {
        this.finalizeLineClears();
      }
    } else {
      // Normal gravity drop mechanics
      this.dropCounter += deltaTime;
      if (this.dropCounter >= this.dropInterval) {
        if (!this.checkCollision(this.activePiece.x, this.activePiece.y + 1, this.activePiece.matrix)) {
          this.activePiece.y++;
          this.dropCounter = 0;
          this.lockDelayCounter = 0;
        } else {
          // Lock delay handling (piece has landed)
          this.lockDelayCounter += deltaTime;
          if (this.lockDelayCounter >= this.lockDelayLimit) {
            this.lockPiece();
            this.dropCounter = 0;
            this.lockDelayCounter = 0;
          }
        }
      }
    }

    // Render components
    this.drawBoard();
    if (this.clearingLines.length === 0) {
      this.drawActivePiece();
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].alpha <= 0) {
        this.particles.splice(i, 1);
      } else {
        this.particles[i].draw(this.ctx);
      }
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  // --- CONTROLLER BINDINGS ---
  setupListeners() {
    // Keyboard controller handles
    document.addEventListener('keydown', (e) => {
      if (!this.playing) return;

      switch (e.code) {
        case 'ArrowLeft':
          this.move(-1);
          e.preventDefault();
          break;
        case 'ArrowRight':
          this.move(1);
          e.preventDefault();
          break;
        case 'ArrowDown':
          this.softDrop();
          e.preventDefault();
          break;
        case 'Space':
          this.hardDrop();
          e.preventDefault();
          break;
        case 'ArrowUp':
          this.rotate(true); // Rotate Clockwise
          e.preventDefault();
          break;
        case 'KeyZ':
          this.rotate(false); // Rotate Counter-Clockwise
          e.preventDefault();
          break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.hold();
          e.preventDefault();
          break;
        case 'KeyP':
        case 'Escape':
          this.togglePause();
          e.preventDefault();
          break;
      }
    });

    // Main overlays button controls
    document.getElementById('start-btn').addEventListener('click', () => this.start());
    document.getElementById('restart-btn').addEventListener('click', () => this.start());
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('sound-btn').addEventListener('click', () => sounds.toggle());

    // Mobile controls mapping
    const bindMobileBtn = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this.playing || this.paused) return;
        action();
      }, { passive: false });

      // Support testing via desktop clicks too
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!this.playing || this.paused) return;
        action();
      });
    };

    bindMobileBtn('m-left', () => this.move(-1));
    bindMobileBtn('m-right', () => this.move(1));
    bindMobileBtn('m-down', () => this.softDrop());
    bindMobileBtn('m-rot', () => this.rotate(true));
    bindMobileBtn('m-hold', () => this.hold());
    bindMobileBtn('m-drop', () => this.hardDrop());
  }
}
