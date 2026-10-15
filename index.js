// ==========================================
// TIC TAC TOE PRO - CYBER NEON EDITION
// ==========================================

(() => {
  'use strict';

  // --- AUDIO SYNTHESIS ENGINE (Web Audio API) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.isMuted = localStorage.getItem('ttt_muted') === 'true';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      localStorage.setItem('ttt_muted', this.isMuted);
      return this.isMuted;
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
      if (this.isMuted) return;
      this.init();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // Audio error fallback
      }
    }

    playMove(player) {
      if (this.isMuted) return;
      this.init();
      if (!this.ctx) return;

      const baseFreq = player === 'X' ? 587.33 : 440; // D5 for X, A4 for O
      this.playTone(baseFreq, 'triangle', 0.12, 0.2);
      setTimeout(() => this.playTone(baseFreq * 1.33, 'sine', 0.08, 0.15), 30);
    }

    playWin() {
      if (this.isMuted) return;
      this.init();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.25), idx * 90);
      });
    }

    playTie() {
      if (this.isMuted) return;
      this.init();
      const notes = [440, 392, 349.23];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.22, 0.18), idx * 100);
      });
    }

    playClick() {
      this.playTone(800, 'square', 0.03, 0.06);
    }

    playUndo() {
      if (this.isMuted) return;
      this.init();
      const notes = [500, 350];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sawtooth', 0.08, 0.1), idx * 60);
      });
    }
  }

  // --- CONFETTI CANNON (Canvas Particle Engine) ---
  class ConfettiCannon {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.particles = [];
      this.animId = null;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    fire() {
      if (!this.ctx) return;
      this.resize();
      const colors = ['#00f2fe', '#ff0844', '#fbbf24', '#a855f7', '#ffffff', '#38bdf8'];
      const count = 90;

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: this.canvas.width * (0.3 + Math.random() * 0.4),
          y: this.canvas.height * 0.5,
          vx: (Math.random() - 0.5) * 16,
          vy: -Math.random() * 14 - 4,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 12,
          gravity: 0.35,
          drag: 0.98,
          alpha: 1,
          decay: Math.random() * 0.015 + 0.008,
        });
      }

      if (!this.animId) {
        this.loop();
      }
    }

    loop() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y > this.canvas.height + 20) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        this.ctx.restore();
      }

      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(() => this.loop());
      } else {
        this.animId = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    clear() {
      this.particles = [];
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // --- TIC TAC TOE GAME CONTROLLER ---
  class TicTacToeGame {
    constructor() {
      this.sound = new SoundEngine();
      this.confetti = new ConfettiCannon('confetti-canvas');

      this.board = Array(9).fill('');
      this.currentPlayer = 'X';
      this.gameActive = true;
      this.currentMode = 'pvp'; // 'pvp', 'ai-easy', 'ai-medium', 'ai-hard'
      this.isAiThinking = false;
      this.moveHistory = [];

      this.winningPositions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
      ];

      // Load persistent state
      this.currentTheme = localStorage.getItem('ttt_theme') || 'dark';
      this.scores = this.loadScores();
      this.matchHistory = this.loadHistory();

      // Cache DOM Elements
      this.dom = {
        grid: document.getElementById('game-grid'),
        cells: Array.from(document.querySelectorAll('.grid-cell')),
        statusBadge: document.getElementById('status-badge'),
        statusDot: document.getElementById('status-dot'),
        statusText: document.getElementById('status-text'),
        scoreX: document.getElementById('score-x'),
        scoreO: document.getElementById('score-o'),
        scoreTies: document.getElementById('score-ties'),
        streakCount: document.getElementById('streak-count'),
        streakPill: document.getElementById('streak-pill'),
        cardPlayerX: document.getElementById('card-player-x'),
        cardPlayerO: document.getElementById('card-player-o'),
        labelPlayerX: document.getElementById('label-player-x'),
        labelPlayerO: document.getElementById('label-player-o'),
        newGameBtn: document.getElementById('new-game-btn'),
        undoBtn: document.getElementById('undo-btn'),
        themeToggle: document.getElementById('theme-toggle'),
        themeIcon: document.getElementById('theme-icon'),
        soundToggle: document.getElementById('sound-toggle'),
        soundIcon: document.getElementById('sound-icon'),
        resetScoresBtn: document.getElementById('reset-scores-btn'),
        modeBtns: document.querySelectorAll('.mode-btn'),
        strikeSvg: document.getElementById('strike-svg'),
        strikeLine: document.getElementById('strike-line'),
        historyModal: document.getElementById('history-modal'),
        historyBtn: document.getElementById('history-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        historyList: document.getElementById('history-list'),
        openHistoryLink: document.getElementById('open-history-link')
      };

      this.initEvents();
      this.applyTheme(this.currentTheme, false);
      this.updateSoundButtonUI();
      this.updateScoreboardUI();
      this.updatePlayerLabels();
      this.resetRound();
    }

    loadScores() {
      try {
        const saved = JSON.parse(localStorage.getItem('ttt_scores'));
        if (saved && typeof saved.x === 'number') return saved;
      } catch (e) {}
      return { x: 0, o: 0, ties: 0, streak: 0, lastWinner: null };
    }

    saveScores() {
      localStorage.setItem('ttt_scores', JSON.stringify(this.scores));
    }

    loadHistory() {
      try {
        const saved = JSON.parse(localStorage.getItem('ttt_history'));
        if (Array.isArray(saved)) return saved;
      } catch (e) {}
      return [];
    }

    saveHistory() {
      localStorage.setItem('ttt_history', JSON.stringify(this.matchHistory.slice(0, 15)));
    }

    initEvents() {
      // Cell clicks
      this.dom.cells.forEach((cell, idx) => {
        cell.addEventListener('click', () => this.handleCellClick(idx));
      });

      // Controls
      this.dom.newGameBtn.addEventListener('click', () => {
        this.sound.playClick();
        this.resetRound();
      });

      this.dom.undoBtn.addEventListener('click', () => {
        this.handleUndo();
      });

      if (this.dom.themeToggle) {
        this.dom.themeToggle.addEventListener('click', () => {
          this.toggleTheme();
        });
      }

      this.dom.soundToggle.addEventListener('click', () => {
        const muted = this.sound.toggleMute();
        this.updateSoundButtonUI();
        if (!muted) this.sound.playClick();
      });

      this.dom.resetScoresBtn.addEventListener('click', () => {
        if (confirm('Do you want to reset all scores and streaks?')) {
          this.scores = { x: 0, o: 0, ties: 0, streak: 0, lastWinner: null };
          this.saveScores();
          this.updateScoreboardUI();
          this.sound.playClick();
        }
      });

      // Mode Switcher
      this.dom.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-mode');
          if (mode === this.currentMode) return;
          this.sound.playClick();
          this.setMode(mode);
        });
      });

      // History Modal
      const openModal = () => {
        this.renderHistoryList();
        this.dom.historyModal.classList.add('open');
        this.sound.playClick();
      };
      const closeModal = () => {
        this.dom.historyModal.classList.remove('open');
      };

      this.dom.historyBtn.addEventListener('click', openModal);
      this.dom.openHistoryLink.addEventListener('click', openModal);
      this.dom.closeModalBtn.addEventListener('click', closeModal);
      this.dom.historyModal.addEventListener('click', (e) => {
        if (e.target === this.dom.historyModal) closeModal();
      });

      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        if (this.dom.historyModal.classList.contains('open')) {
          if (e.key === 'Escape') closeModal();
          return;
        }

        const key = e.key.toLowerCase();
        if (key >= '1' && key <= '9') {
          const idx = parseInt(key, 10) - 1;
          this.handleCellClick(idx);
        } else if (key === 'r') {
          this.resetRound();
        } else if (key === 'u') {
          this.handleUndo();
        } else if (key === 'm') {
          this.sound.toggleMute();
          this.updateSoundButtonUI();
        } else if (key === 't') {
          this.toggleTheme();
        }
      });

      // Window resize adjusts strike line
      window.addEventListener('resize', () => {
        this.recalculateStrikeLine();
      });
    }

    setMode(mode) {
      this.currentMode = mode;
      this.dom.modeBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-mode') === mode);
      });
      this.updatePlayerLabels();
      this.resetRound();
    }

    applyTheme(theme, playAudio = true) {
      this.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('ttt_theme', theme);

      if (this.dom.themeIcon) {
        this.dom.themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
      }
      if (this.dom.themeToggle) {
        this.dom.themeToggle.title = theme === 'light'
          ? 'Switch to Dark Mode (Press T)'
          : 'Switch to Light Mode (Press T)';
        this.dom.themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
      }

      if (playAudio) {
        this.sound.playClick();
      }

      this.recalculateStrikeLine();
    }

    toggleTheme() {
      const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
      this.applyTheme(nextTheme, true);
    }

    updatePlayerLabels() {
      if (this.currentMode === 'pvp') {
        this.dom.labelPlayerX.textContent = 'PLAYER 1';
        this.dom.labelPlayerO.textContent = 'PLAYER 2';
      } else {
        this.dom.labelPlayerX.textContent = 'YOU (X)';
        const botName = this.currentMode === 'ai-easy' ? 'BOT (EASY)'
          : this.currentMode === 'ai-medium' ? 'BOT (MED)'
          : 'BOT (GOD)';
        this.dom.labelPlayerO.textContent = botName;
      }
    }

    updateSoundButtonUI() {
      const isMuted = this.sound.isMuted;
      this.dom.soundToggle.classList.toggle('active', !isMuted);
      this.dom.soundIcon.textContent = isMuted ? '🔇' : '🔊';
      this.dom.soundToggle.title = isMuted ? 'Sound Muted (Press M)' : 'Sound On (Press M)';
    }

    updateScoreboardUI() {
      this.dom.scoreX.textContent = this.scores.x;
      this.dom.scoreO.textContent = this.scores.o;
      this.dom.scoreTies.textContent = this.scores.ties;
      this.dom.streakCount.textContent = this.scores.streak;

      if (this.scores.streak >= 3) {
        this.dom.streakPill.style.display = 'flex';
      } else {
        this.dom.streakPill.style.display = 'flex';
      }
    }

    updateGhostPreviews() {
      const isHumanTurn = this.currentMode === 'pvp' || this.currentPlayer === 'X';
      this.dom.cells.forEach((cell, idx) => {
        if (this.gameActive && !this.board[idx] && isHumanTurn && !this.isAiThinking) {
          cell.setAttribute('data-ghost', this.currentPlayer);
        } else {
          cell.removeAttribute('data-ghost');
        }
      });
    }

    updateTurnCardsUI() {
      const isX = this.currentPlayer === 'X';
      this.dom.cardPlayerX.classList.toggle('active-turn', isX && this.gameActive);
      this.dom.cardPlayerO.classList.toggle('active-turn', !isX && this.gameActive);

      this.dom.statusDot.className = 'status-indicator-dot';
      if (!this.gameActive) {
        this.dom.statusDot.classList.add('winner');
      } else if (!isX) {
        this.dom.statusDot.classList.add('o-turn');
      }

      if (this.gameActive) {
        if (this.isAiThinking) {
          this.dom.statusText.textContent = 'AI is calculating...';
        } else if (this.currentMode === 'pvp') {
          this.dom.statusText.textContent = `Player ${this.currentPlayer}'s Turn`;
        } else {
          this.dom.statusText.textContent = this.currentPlayer === 'X' ? "Your Turn (X)" : "AI's Turn (O)";
        }
      }

      this.dom.undoBtn.disabled = !this.gameActive || this.moveHistory.length === 0 || this.isAiThinking;
      this.updateGhostPreviews();
    }

    resetRound() {
      this.board = Array(9).fill('');
      this.currentPlayer = 'X';
      this.gameActive = true;
      this.isAiThinking = false;
      this.moveHistory = [];
      this.confetti.clear();

      this.clearStrikeLine();

      this.dom.cells.forEach(cell => {
        cell.innerHTML = '';
        cell.className = 'grid-cell';
      });

      this.updateTurnCardsUI();
    }

    handleCellClick(index) {
      if (!this.gameActive || this.board[index] !== '' || this.isAiThinking) return;

      // In AI mode, user can only play on their turn (X)
      if (this.currentMode !== 'pvp' && this.currentPlayer !== 'X') return;

      this.makeMove(index, this.currentPlayer);

      // AI response if applicable
      if (this.gameActive && this.currentMode !== 'pvp' && this.currentPlayer === 'O') {
        this.triggerAiMove();
      }
    }

    makeMove(index, player) {
      this.board[index] = player;
      this.moveHistory.push({ index, player });

      const cell = this.dom.cells[index];
      cell.classList.add('occupied');

      const symbolSpan = document.createElement('span');
      symbolSpan.className = `cell-symbol ${player.toLowerCase()}-mark`;
      symbolSpan.textContent = player === 'X' ? '✕' : '○';
      cell.appendChild(symbolSpan);

      this.sound.playMove(player);

      const winResult = this.checkWin(this.board);

      if (winResult) {
        this.handleGameOver(winResult.winner, winResult.line);
        return;
      }

      if (this.checkTie(this.board)) {
        this.handleGameOver('tie');
        return;
      }

      // Swap turn
      this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
      this.updateTurnCardsUI();
    }

    triggerAiMove() {
      this.isAiThinking = true;
      this.updateTurnCardsUI();

      // Dynamic thinking delay based on mode
      const delay = Math.floor(Math.random() * 200) + 300;

      setTimeout(() => {
        if (!this.gameActive) {
          this.isAiThinking = false;
          return;
        }

        let bestIndex = -1;

        if (this.currentMode === 'ai-easy') {
          bestIndex = this.getEasyAiMove();
        } else if (this.currentMode === 'ai-medium') {
          bestIndex = this.getMediumAiMove();
        } else {
          bestIndex = this.getGodAiMove();
        }

        this.isAiThinking = false;
        if (bestIndex !== -1 && this.board[bestIndex] === '') {
          this.makeMove(bestIndex, 'O');
        }
      }, delay);
    }

    getAvailableMoves(currentBoard) {
      const moves = [];
      for (let i = 0; i < 9; i++) {
        if (currentBoard[i] === '') moves.push(i);
      }
      return moves;
    }

    // AI - Easy: mostly random, occasional winning block
    getEasyAiMove() {
      const emptyCells = this.getAvailableMoves(this.board);
      if (emptyCells.length === 0) return -1;

      // 40% chance to take a winning spot if exists
      if (Math.random() < 0.4) {
        for (const idx of emptyCells) {
          this.board[idx] = 'O';
          if (this.checkWin(this.board)) {
            this.board[idx] = '';
            return idx;
          }
          this.board[idx] = '';
        }
      }

      return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    // AI - Medium: Smart tactical (wins if can win, blocks if human can win, else 50% minimax)
    getMediumAiMove() {
      const emptyCells = this.getAvailableMoves(this.board);
      if (emptyCells.length === 0) return -1;

      // 1. Can AI win right now?
      for (const idx of emptyCells) {
        this.board[idx] = 'O';
        if (this.checkWin(this.board)) {
          this.board[idx] = '';
          return idx;
        }
        this.board[idx] = '';
      }

      // 2. Can human win on next turn? Block it!
      for (const idx of emptyCells) {
        this.board[idx] = 'X';
        if (this.checkWin(this.board)) {
          this.board[idx] = '';
          return idx;
        }
        this.board[idx] = '';
      }

      // 3. Take center if available
      if (this.board[4] === '' && Math.random() < 0.7) return 4;

      // 4. Mix of minimax and random
      if (Math.random() < 0.6) {
        return this.getGodAiMove();
      }

      return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    // AI - God Mode: Perfect Minimax (Unbeatable)
    getGodAiMove() {
      const emptyCells = this.getAvailableMoves(this.board);
      if (emptyCells.length === 0) return -1;

      // If board is empty, picking center or corner is fastest optimal move
      if (emptyCells.length === 9) return 4;

      let bestScore = -Infinity;
      let move = emptyCells[0];

      for (const idx of emptyCells) {
        this.board[idx] = 'O';
        const score = this.minimax(this.board, 0, false, -Infinity, Infinity);
        this.board[idx] = '';
        if (score > bestScore) {
          bestScore = score;
          move = idx;
        }
      }

      return move;
    }

    minimax(board, depth, isMaximizing, alpha, beta) {
      const win = this.checkWin(board);
      if (win) {
        return win.winner === 'O' ? 10 - depth : depth - 10;
      }
      if (this.checkTie(board)) return 0;

      const emptyCells = this.getAvailableMoves(board);

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (const idx of emptyCells) {
          board[idx] = 'O';
          const evaluation = this.minimax(board, depth + 1, false, alpha, beta);
          board[idx] = '';
          maxEval = Math.max(maxEval, evaluation);
          alpha = Math.max(alpha, evaluation);
          if (beta <= alpha) break;
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        for (const idx of emptyCells) {
          board[idx] = 'X';
          const evaluation = this.minimax(board, depth + 1, true, alpha, beta);
          board[idx] = '';
          minEval = Math.min(minEval, evaluation);
          beta = Math.min(beta, evaluation);
          if (beta <= alpha) break;
        }
        return minEval;
      }
    }

    handleUndo() {
      if (!this.gameActive || this.moveHistory.length === 0 || this.isAiThinking) return;

      this.sound.playUndo();

      if (this.currentMode === 'pvp') {
        // Undo 1 move
        const lastMove = this.moveHistory.pop();
        this.board[lastMove.index] = '';
        this.dom.cells[lastMove.index].innerHTML = '';
        this.dom.cells[lastMove.index].className = 'grid-cell';
        this.currentPlayer = lastMove.player;
      } else {
        // Undo AI move + human move
        while (this.moveHistory.length > 0) {
          const m = this.moveHistory.pop();
          this.board[m.index] = '';
          this.dom.cells[m.index].innerHTML = '';
          this.dom.cells[m.index].className = 'grid-cell';
          if (m.player === 'X') break;
        }
        this.currentPlayer = 'X';
      }

      this.updateTurnCardsUI();
    }

    checkWin(currentBoard) {
      for (const pos of this.winningPositions) {
        const [a, b, c] = pos;
        if (
          currentBoard[a] !== '' &&
          currentBoard[a] === currentBoard[b] &&
          currentBoard[b] === currentBoard[c]
        ) {
          return { winner: currentBoard[a], line: pos };
        }
      }
      return null;
    }

    checkTie(currentBoard) {
      return currentBoard.every(cell => cell !== '');
    }

    handleGameOver(winner, line = null) {
      this.gameActive = false;
      this.isAiThinking = false;

      if (winner === 'tie') {
        this.dom.statusText.textContent = "Round Tied! 🤝";
        this.sound.playTie();
        this.scores.ties++;
        this.scores.streak = 0;
        this.scores.lastWinner = null;
        this.recordHistory('Tie', 'draw');
      } else {
        const winnerName = this.currentMode === 'pvp'
          ? `Player ${winner}`
          : (winner === 'X' ? 'You' : 'AI Bot');

        this.dom.statusText.textContent = `🎉 ${winnerName} Wins!`;

        // Highlight cells
        line.forEach(idx => {
          this.dom.cells[idx].classList.add('winning-cell');
        });

        // Draw strike line
        this.drawStrikeLine(line, winner);

        // Sound & Confetti
        this.sound.playWin();
        this.confetti.fire();

        // Update scores & streak
        if (winner === 'X') {
          this.scores.x++;
          if (this.scores.lastWinner === 'X') {
            this.scores.streak++;
          } else {
            this.scores.streak = 1;
          }
          this.scores.lastWinner = 'X';
        } else {
          this.scores.o++;
          if (this.scores.lastWinner === 'O') {
            this.scores.streak++;
          } else {
            this.scores.streak = 1;
          }
          this.scores.lastWinner = 'O';
        }

        this.recordHistory(`${winnerName} Won`, winner === 'X' ? 'win-x' : 'win-o');
      }

      this.saveScores();
      this.updateScoreboardUI();
      this.updateTurnCardsUI();
    }

    drawStrikeLine(line, winner) {
      const cellA = this.dom.cells[line[0]];
      const cellC = this.dom.cells[line[2]];
      const gridRect = this.dom.grid.getBoundingClientRect();
      const rectA = cellA.getBoundingClientRect();
      const rectC = cellC.getBoundingClientRect();

      const x1 = rectA.left + rectA.width / 2 - gridRect.left;
      const y1 = rectA.top + rectA.height / 2 - gridRect.top;
      const x2 = rectC.left + rectC.width / 2 - gridRect.left;
      const y2 = rectC.top + rectC.height / 2 - gridRect.top;

      // Extend slightly beyond centers
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      const extend = 24;
      const nx = (dx / length) * extend;
      const ny = (dy / length) * extend;

      const finalX1 = x1 - nx;
      const finalY1 = y1 - ny;
      const finalX2 = x2 + nx;
      const finalY2 = y2 + ny;

      this.dom.strikeLine.setAttribute('x1', finalX1);
      this.dom.strikeLine.setAttribute('y1', finalY1);
      this.dom.strikeLine.setAttribute('x2', finalX2);
      this.dom.strikeLine.setAttribute('y2', finalY2);

      const isLight = this.currentTheme === 'light';
      const colorX = isLight ? '#0284c7' : '#00f2fe';
      const colorO = isLight ? '#e11d48' : '#ff0844';
      const color = winner === 'X' ? colorX : colorO;
      this.dom.strikeLine.setAttribute('stroke', color);
      this.dom.strikeLine.classList.add('active');

      this.lastWinningLine = line;
      this.lastWinner = winner;
    }

    recalculateStrikeLine() {
      if (!this.gameActive && this.lastWinningLine && this.lastWinner) {
        this.drawStrikeLine(this.lastWinningLine, this.lastWinner);
      }
    }

    clearStrikeLine() {
      this.lastWinningLine = null;
      this.lastWinner = null;
      this.dom.strikeLine.classList.remove('active');
    }

    recordHistory(resultText, outcomeClass) {
      const modeLabel = this.currentMode === 'pvp' ? 'PvP'
        : this.currentMode === 'ai-easy' ? 'Easy AI'
        : this.currentMode === 'ai-medium' ? 'Med AI'
        : 'God AI';

      const entry = {
        result: resultText,
        mode: modeLabel,
        moves: this.moveHistory.length,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: outcomeClass
      };

      this.matchHistory.unshift(entry);
      this.saveHistory();
    }

    renderHistoryList() {
      if (this.matchHistory.length === 0) {
        this.dom.historyList.innerHTML = `<p style="color: var(--text-dim); text-align: center; padding: 1.5rem;">No games recorded yet. Play a round!</p>`;
        return;
      }

      this.dom.historyList.innerHTML = this.matchHistory.map(item => `
        <div class="history-item ${item.type}">
          <div>
            <strong>${item.result}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
              ${item.mode} &bull; ${item.moves} moves &bull; ${item.time}
            </div>
          </div>
          <span class="history-badge" style="color: ${item.type === 'win-x' ? 'var(--neon-x)' : item.type === 'win-o' ? 'var(--neon-o)' : 'var(--text-dim)'}">
            ${item.type === 'win-x' ? 'X WIN' : item.type === 'win-o' ? 'O WIN' : 'DRAW'}
          </span>
        </div>
      `).join('');
    }
  }

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TicTacToeGame());
  } else {
    new TicTacToeGame();
  }
})();