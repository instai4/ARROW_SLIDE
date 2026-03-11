<<<<<<< HEAD
  (function() {
            const Sound = {
                context: null,
                init() {
                    if (!this.context) {
                        this.context = new (window.AudioContext || window.webkitAudioContext)();
                    }
                },
                playMove() {
                    this.init();
                    if (this.context.state === 'suspended') {
                        this.context.resume();
                        return;
                    }
                    const osc = this.context.createOscillator();
                    const gain = this.context.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 620;
                    gain.gain.value = 0.08;
                    osc.connect(gain).connect(this.context.destination);
                    osc.start();
                    osc.stop(this.context.currentTime + 0.07);
                },
                playWin() {
                    this.init();
                    if (this.context.state === 'suspended') return;
                    const now = this.context.currentTime;
                    [523.25, 659.25, 783.99].forEach((freq, i) => {
                        const osc = this.context.createOscillator();
                        const gain = this.context.createGain();
                        osc.type = 'triangle';
                        osc.frequency.value = freq;
                        gain.gain.value = 0.1;
                        osc.connect(gain).connect(this.context.destination);
                        osc.start(now + i * 0.12);
                        osc.stop(now + i * 0.15 + 0.1);
                    });
                }
            };

            class GameState {
                constructor() {
                    this.level = 1;
                    this.moves = 0;
                    this.grid = [];
                    this.size = 5;
                    this.arrows = ['↑', '↓', '←', '→'];
                    this.winFlag = false;
                }

                newGrid() {
                    const size = this.size;
                    const p = Math.min(0.9, 0.65 + this.level * 0.02);
                    const grid = Array(size).fill().map(() => Array(size).fill(null));
                    
                    const rowLeft = Array(size).fill(false);
                    const rowRight = Array(size).fill(false);
                    const colUp = Array(size).fill(false);
                    const colDown = Array(size).fill(false);

                    for (let r = 0; r < size; r++) {
                        for (let c = 0; c < size; c++) {
                            if (Math.random() < p) {
                                const allowed = [];
                                if (!rowRight[r]) allowed.push('←');
                                if (!rowLeft[r]) allowed.push('→');
                                if (!colDown[c]) allowed.push('↑');
                                if (!colUp[c]) allowed.push('↓');

                                if (allowed.length === 0) continue;

                                const dir = allowed[Math.floor(Math.random() * allowed.length)];
                                grid[r][c] = dir;

                                switch (dir) {
                                    case '←': rowLeft[r] = true; break;
                                    case '→': rowRight[r] = true; break;
                                    case '↑': colUp[c] = true; break;
                                    case '↓': colDown[c] = true; break;
                                }
                            }
                        }
                    }
                    return grid;
                }

                reset(keepLevel = true) {
                    if (!keepLevel) this.level = 1;
                    this.size = Math.min(7, 4 + this.level);
                    this.grid = this.newGrid();
                    this.moves = 0;
                    this.winFlag = false;
                }

                getMovePath(r, c) {
                    const arrow = this.grid[r]?.[c];
                    if (!arrow) return null;

                    const dirs = { '↑': [-1, 0], '↓': [1, 0], '←': [0, -1], '→': [0, 1] };
                    const [dr, dc] = dirs[arrow];

                    let path = [{ r, c }];
                    let nr = r + dr;
                    let nc = c + dc;

                    if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) {
                        return { path, action: 'remove' };
                    }

                    while (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && this.grid[nr][nc] === null) {
                        path.push({ r: nr, c: nc });
                        nr += dr;
                        nc += dc;
                    }

                    if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) {
                        return { path, action: 'remove' };
                    } else {
                        return { path, action: 'stop' };
                    }
                }

                applyStep(fromR, fromC, toR, toC) {
                    const arrow = this.grid[fromR][fromC];
                    this.grid[fromR][fromC] = null;
                    if (toR !== undefined && toC !== undefined) {
                        this.grid[toR][toC] = arrow;
                    }
                }

                isWin() {
                    for (let row of this.grid) {
                        for (let cell of row) {
                            if (cell !== null) return false;
                        }
                    }
                    return true;
                }

                levelUp() {
                    this.level++;
                    this.size = Math.min(7, 4 + this.level);
                    this.grid = this.newGrid();
                    this.moves = 0;
                    this.winFlag = false;
                }

                load(saved) {
                    this.level = saved.level || 1;
                    this.moves = saved.moves || 0;
                    this.grid = saved.grid || [];
                    this.size = this.grid.length || 5;
                }

                serialize() {
                    return {
                        level: this.level,
                        moves: this.moves,
                        grid: this.grid,
                        version: 5
                    };
                }
            }

            const Storage = {
                key: 'arrowPuzzleBrutal',
                save(state) {
                    try {
                        localStorage.setItem(this.key, JSON.stringify(state.serialize()));
                    } catch (e) {}
                },
                load() {
                    try {
                        const raw = localStorage.getItem(this.key);
                        if (!raw) return null;
                        const data = JSON.parse(raw);
                        if (data.version !== 5) return null;
                        return data;
                    } catch (e) {
                        return null;
                    }
                }
            };

            class UIManager {
                constructor(game, gridEl, levelSpan, movesSpan, congratsEl, stuckEl) {
                    this.game = game;
                    this.gridEl = gridEl;
                    this.levelSpan = levelSpan;
                    this.movesSpan = movesSpan;
                    this.congratsEl = congratsEl;
                    this.stuckEl = stuckEl;
                }

                render() {
                    this.gridEl.style.gridTemplateColumns = `repeat(${this.game.size}, 1fr)`;
                    let html = '';
                    for (let r = 0; r < this.game.size; r++) {
                        for (let c = 0; c < this.game.size; c++) {
                            const val = this.game.grid[r][c];
                            const emptyClass = val === null ? 'empty' : '';
                            html += `<div class="cell ${emptyClass}" data-row="${r}" data-col="${c}">${val || ''}</div>`;
                        }
                    }
                    this.gridEl.innerHTML = html;
                    this.levelSpan.textContent = this.game.level;
                    this.movesSpan.textContent = this.game.moves;
                }

                showCongrats(show) {
                    this.congratsEl.style.display = show ? 'block' : 'none';
                }

                showStuck(show) {
                    this.stuckEl.style.display = show ? 'block' : 'none';
                }

                bindEvents(handler) {
                    this.gridEl.addEventListener('click', (e) => {
                        const cell = e.target.closest('.cell');
                        if (!cell) return;
                        if (cell.classList.contains('empty')) return;
                        const row = parseInt(cell.dataset.row, 10);
                        const col = parseInt(cell.dataset.col, 10);
                        handler(row, col);
                    });
                    this.gridEl.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                    }, { passive: false });
                }

                highlightCell(r, c) {
                    this.clearHint();
                    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) cell.classList.add('hint');
                }

                clearHint() {
                    document.querySelectorAll('.cell.hint').forEach(cell => cell.classList.remove('hint'));
                }
            }

            class GameController {
                constructor() {
                    this.game = new GameState();
                    this.ui = new UIManager(
                        this.game,
                        document.getElementById('gridContainer'),
                        document.getElementById('levelDisplay'),
                        document.getElementById('movesDisplay'),
                        document.getElementById('congratsMessage'),
                        document.getElementById('stuckMessage')
                    );
                    this.isAnimating = false;
                    this.undoStack = [];
                    this.maxUndo = 20;
                    this.nextLevelTimeout = null;
                    this.stuckFlag = false;

                    const saved = Storage.load();
                    if (saved) {
                        this.game.load(saved);
                    } else {
                        this.game.reset();
                    }

                    this.ui.render();
                    this.ui.bindEvents((r, c) => this.handleCellClick(r, c));
                    this.checkStuck();

                    document.getElementById('undoBtn').addEventListener('click', () => this.undo());
                    document.getElementById('hintBtn').addEventListener('click', () => this.hint());
                    document.getElementById('restartBtn').addEventListener('click', () => this.restart());
                    document.getElementById('nextBtn').addEventListener('click', () => this.nextLevel());

                    document.addEventListener('click', function unlockAudio() {
                        Sound.init();
                        document.removeEventListener('click', unlockAudio);
                    }, { once: true });
                }

                hasAnyMove() {
                    for (let r = 0; r < this.game.size; r++) {
                        for (let c = 0; c < this.game.size; c++) {
                            if (this.game.grid[r][c] === null) continue;
                            const pathInfo = this.game.getMovePath(r, c);
                            if (pathInfo) {
                                if (pathInfo.path.length > 1 || (pathInfo.path.length === 1 && pathInfo.action === 'remove')) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                }

                checkStuck() {
                    if (this.game.winFlag) {
                        this.stuckFlag = false;
                        this.ui.showStuck(false);
                        return;
                    }
                    const movable = this.hasAnyMove();
                    this.stuckFlag = !movable;
                    this.ui.showStuck(!movable);
                }

                pushState() {
                    const state = {
                        grid: this.game.grid.map(row => [...row]),
                        moves: this.game.moves,
                        level: this.game.level,
                        size: this.game.size
                    };
                    this.undoStack.push(state);
                    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
                }

                undo() {
                    if (this.isAnimating || this.game.winFlag) return;
                    if (this.undoStack.length === 0) return;
                    const prev = this.undoStack.pop();
                    this.game.grid = prev.grid.map(row => [...row]);
                    this.game.moves = prev.moves;
                    this.game.level = prev.level;
                    this.game.size = prev.size;
                    this.game.winFlag = false;
                    this.ui.clearHint();
                    this.ui.render();
                    Storage.save(this.game);
                    this.ui.showCongrats(false);
                    if (this.nextLevelTimeout) {
                        clearTimeout(this.nextLevelTimeout);
                        this.nextLevelTimeout = null;
                    }
                    this.checkStuck();
                }

                hint() {
                    if (this.isAnimating || this.game.winFlag || this.stuckFlag) return;
                    this.ui.clearHint();

                    const validMoves = [];
                    for (let r = 0; r < this.game.size; r++) {
                        for (let c = 0; c < this.game.size; c++) {
                            if (this.game.grid[r][c] === null) continue;
                            const pathInfo = this.game.getMovePath(r, c);
                            if (pathInfo) {
                                if (pathInfo.path.length > 1 || (pathInfo.path.length === 1 && pathInfo.action === 'remove')) {
                                    validMoves.push({ r, c });
                                }
                            }
                        }
                    }

                    if (validMoves.length === 0) return;

                    const randomIndex = Math.floor(Math.random() * validMoves.length);
                    const { r, c } = validMoves[randomIndex];
                    this.ui.highlightCell(r, c);
                    setTimeout(() => this.ui.clearHint(), 2000);
                }

                handleCellClick(r, c) {
                    if (this.isAnimating || this.game.winFlag || this.stuckFlag) return;

                    const pathInfo = this.game.getMovePath(r, c);
                    if (!pathInfo) return;
                    const { path, action } = pathInfo;
                    if (path.length === 0) return;
                    if (path.length === 1 && action === 'stop') return;

                    this.pushState();
                    this.isAnimating = true;
                    this.ui.clearHint();

                    let stepIndex = 0;
                    const performStep = () => {
                        if (stepIndex < path.length - 1) {
                            const from = path[stepIndex];
                            const to = path[stepIndex + 1];
                            this.game.applyStep(from.r, from.c, to.r, to.c);
                            this.ui.render();
                            Sound.playMove();
                            stepIndex++;
                            setTimeout(performStep, 70);
                        } else {
                            if (action === 'remove') {
                                const last = path[path.length - 1];
                                this.game.applyStep(last.r, last.c, undefined, undefined);
                                this.ui.render();
                                Sound.playMove();
                            }
                            this.game.moves++;
                            this.ui.movesSpan.textContent = this.game.moves;
                            this.isAnimating = false;
                            Storage.save(this.game);

                            if (this.game.isWin()) {
                                this.game.winFlag = true;
                                Sound.playWin();
                                this.ui.showCongrats(true);
                                this.ui.showStuck(false);
                                this.nextLevelTimeout = setTimeout(() => {
                                    this.nextLevel();
                                }, 2000);
                            } else {
                                this.checkStuck();
                            }
                        }
                    };

                    if (path.length === 1 && action === 'remove') {
                        this.game.applyStep(r, c, undefined, undefined);
                        this.ui.render();
                        Sound.playMove();
                        this.game.moves++;
                        this.ui.movesSpan.textContent = this.game.moves;
                        this.isAnimating = false;
                        Storage.save(this.game);
                        if (this.game.isWin()) {
                            this.game.winFlag = true;
                            Sound.playWin();
                            this.ui.showCongrats(true);
                            this.ui.showStuck(false);
                            this.nextLevelTimeout = setTimeout(() => {
                                this.nextLevel();
                            }, 2000);
                        } else {
                            this.checkStuck();
                        }
                    } else {
                        performStep();
                    }
                }

                restart() {
                    if (this.isAnimating) return;
                    this.game.reset(true);
                    this.undoStack = [];
                    this.ui.clearHint();
                    this.ui.render();
                    this.ui.showCongrats(false);
                    this.ui.showStuck(false);
                    Storage.save(this.game);
                    if (this.nextLevelTimeout) {
                        clearTimeout(this.nextLevelTimeout);
                        this.nextLevelTimeout = null;
                    }
                    this.checkStuck();
                }

                nextLevel() {
                    if (this.isAnimating) return;
                    this.game.levelUp();
                    this.undoStack = [];
                    this.ui.clearHint();
                    this.ui.render();
                    this.ui.showCongrats(false);
                    this.ui.showStuck(false);
                    Storage.save(this.game);
                    if (this.nextLevelTimeout) {
                        clearTimeout(this.nextLevelTimeout);
                        this.nextLevelTimeout = null;
                    }
                    this.checkStuck();
                }
            }

            // Custom cursor
            const cursor = document.getElementById('cursor');
            if (cursor) {
                document.addEventListener('mousemove', (e) => {
                    cursor.style.left = e.clientX + 'px';
                    cursor.style.top = e.clientY + 'px';
                });
                const hoverEls = document.querySelectorAll('.btn, .cell');
                hoverEls.forEach(el => {
                    el.addEventListener('mouseenter', () => {
                        cursor.style.width = '60px';
                        cursor.style.height = '60px';
                        cursor.style.backgroundColor = '#FBFF48';
                        cursor.style.mixBlendMode = 'normal';
                        cursor.style.border = '2px solid black';
                    });
                    el.addEventListener('mouseleave', () => {
                        cursor.style.width = '24px';
                        cursor.style.height = '24px';
                        cursor.style.backgroundColor = 'white';
                        cursor.style.mixBlendMode = 'difference';
                        cursor.style.border = '2px solid black';
                    });
                });
            }

            window.addEventListener('DOMContentLoaded', () => {
                new GameController();
            });
        })();
    
=======
   (function() {
            const Sound = {
                context: null,
                init() {
                    if (!this.context) {
                        this.context = new (window.AudioContext || window.webkitAudioContext)();
                    }
                },
                playMove() {
                    this.init();
                    if (this.context.state === 'suspended') {
                        this.context.resume();
                        return;
                    }
                    const osc = this.context.createOscillator();
                    const gain = this.context.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 620;
                    gain.gain.value = 0.08;
                    osc.connect(gain).connect(this.context.destination);
                    osc.start();
                    osc.stop(this.context.currentTime + 0.07);
                },
                playWin() {
                    this.init();
                    if (this.context.state === 'suspended') return;
                    const now = this.context.currentTime;
                    [523.25, 659.25, 783.99].forEach((freq, i) => {
                        const osc = this.context.createOscillator();
                        const gain = this.context.createGain();
                        osc.type = 'triangle';
                        osc.frequency.value = freq;
                        gain.gain.value = 0.1;
                        osc.connect(gain).connect(this.context.destination);
                        osc.start(now + i * 0.12);
                        osc.stop(now + i * 0.15 + 0.1);
                    });
                }
            };

            class GameState {
                constructor() {
                    this.level = 1;
                    this.moves = 0;
                    this.grid = [];
                    this.size = 5;
                    this.arrows = ['↑', '↓', '←', '→'];
                    this.winFlag = false;
                }

                // Check if any arrow in the given grid has a valid move
                hasAnyMove(grid) {
                    for (let r = 0; r < grid.length; r++) {
                        for (let c = 0; c < grid.length; c++) {
                            if (grid[r][c] === null) continue;
                            const pathInfo = this.getMovePathForGrid(grid, r, c);
                            if (pathInfo) {
                                if (pathInfo.path.length > 1 || (pathInfo.path.length === 1 && pathInfo.action === 'remove')) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                }

                getMovePathForGrid(grid, r, c) {
                    const arrow = grid[r]?.[c];
                    if (!arrow) return null;

                    const dirs = { '↑': [-1, 0], '↓': [1, 0], '←': [0, -1], '→': [0, 1] };
                    const [dr, dc] = dirs[arrow];

                    let path = [{ r, c }];
                    let nr = r + dr;
                    let nc = c + dc;

                    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid.length) {
                        return { path, action: 'remove' };
                    }

                    while (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid.length && grid[nr][nc] === null) {
                        path.push({ r: nr, c: nc });
                        nr += dr;
                        nc += dc;
                    }

                    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid.length) {
                        return { path, action: 'remove' };
                    } else {
                        return { path, action: 'stop' };
                    }
                }

                // Generate a grid that guarantees at least one move
                newGrid() {
                    const size = this.size;
                    const p = Math.min(0.9, 0.65 + this.level * 0.02);
                    let attempts = 0;
                    const maxAttempts = 100;

                    while (attempts < maxAttempts) {
                        const grid = Array(size).fill().map(() => Array(size).fill(null));
                        
                        const rowLeft = Array(size).fill(false);
                        const rowRight = Array(size).fill(false);
                        const colUp = Array(size).fill(false);
                        const colDown = Array(size).fill(false);

                        for (let r = 0; r < size; r++) {
                            for (let c = 0; c < size; c++) {
                                if (Math.random() < p) {
                                    const allowed = [];
                                    if (!rowRight[r]) allowed.push('←');
                                    if (!rowLeft[r]) allowed.push('→');
                                    if (!colDown[c]) allowed.push('↑');
                                    if (!colUp[c]) allowed.push('↓');

                                    if (allowed.length === 0) continue;

                                    const dir = allowed[Math.floor(Math.random() * allowed.length)];
                                    grid[r][c] = dir;

                                    switch (dir) {
                                        case '←': rowLeft[r] = true; break;
                                        case '→': rowRight[r] = true; break;
                                        case '↑': colUp[c] = true; break;
                                        case '↓': colDown[c] = true; break;
                                    }
                                }
                            }
                        }

                        // Ensure at least one move exists
                        if (this.hasAnyMove(grid)) {
                            return grid;
                        }
                        attempts++;
                    }
                    // Fallback: create a simple movable arrow
                    const fallbackGrid = Array(size).fill().map(() => Array(size).fill(null));
                    fallbackGrid[0][0] = '→'; // This will move right if empty
                    return fallbackGrid;
                }

                reset(keepLevel = true) {
                    if (!keepLevel) this.level = 1;
                    this.size = Math.min(7, 4 + this.level);
                    this.grid = this.newGrid();
                    this.moves = 0;
                    this.winFlag = false;
                }

                getMovePath(r, c) {
                    return this.getMovePathForGrid(this.grid, r, c);
                }

                applyStep(fromR, fromC, toR, toC) {
                    const arrow = this.grid[fromR][fromC];
                    this.grid[fromR][fromC] = null;
                    if (toR !== undefined && toC !== undefined) {
                        this.grid[toR][toC] = arrow;
                    }
                }

                isWin() {
                    for (let row of this.grid) {
                        for (let cell of row) {
                            if (cell !== null) return false;
                        }
                    }
                    return true;
                }

                levelUp() {
                    this.level++;
                    this.size = Math.min(7, 4 + this.level);
                    this.grid = this.newGrid();
                    this.moves = 0;
                    this.winFlag = false;
                }

                load(saved) {
                    this.level = saved.level || 1;
                    this.moves = saved.moves || 0;
                    this.grid = saved.grid || [];
                    this.size = this.grid.length || 5;
                }

                serialize() {
                    return {
                        level: this.level,
                        moves: this.moves,
                        grid: this.grid,
                        version: 5
                    };
                }
            }

            const Storage = {
                key: 'arrowPuzzleBrutal',
                save(state) {
                    try {
                        localStorage.setItem(this.key, JSON.stringify(state.serialize()));
                    } catch (e) {}
                },
                load() {
                    try {
                        const raw = localStorage.getItem(this.key);
                        if (!raw) return null;
                        const data = JSON.parse(raw);
                        if (data.version !== 5) return null;
                        return data;
                    } catch (e) {
                        return null;
                    }
                }
            };

            class UIManager {
                constructor(game, gridEl, levelSpan, movesSpan, congratsEl, stuckEl) {
                    this.game = game;
                    this.gridEl = gridEl;
                    this.levelSpan = levelSpan;
                    this.movesSpan = movesSpan;
                    this.congratsEl = congratsEl;
                    this.stuckEl = stuckEl;
                }

                render() {
                    this.gridEl.style.gridTemplateColumns = `repeat(${this.game.size}, 1fr)`;
                    let html = '';
                    for (let r = 0; r < this.game.size; r++) {
                        for (let c = 0; c < this.game.size; c++) {
                            const val = this.game.grid[r][c];
                            const emptyClass = val === null ? 'empty' : '';
                            html += `<div class="cell ${emptyClass}" data-row="${r}" data-col="${c}">${val || ''}</div>`;
                        }
                    }
                    this.gridEl.innerHTML = html;
                    this.levelSpan.textContent = this.game.level;
                    this.movesSpan.textContent = this.game.moves;
                }

                showCongrats(show) {
                    this.congratsEl.style.display = show ? 'block' : 'none';
                }

                showStuck(show) {
                    this.stuckEl.style.display = show ? 'block' : 'none';
                }

                bindEvents(handler) {
                    // Use both click and touchend for reliable mobile interaction
                    const handleTap = (e) => {
                        const cell = e.target.closest('.cell');
                        if (!cell) return;
                        if (cell.classList.contains('empty')) return;
                        const row = parseInt(cell.dataset.row, 10);
                        const col = parseInt(cell.dataset.col, 10);
                        handler(row, col);
                    };

                    this.gridEl.addEventListener('click', handleTap);
                    this.gridEl.addEventListener('touchend', (e) => {
                        e.preventDefault(); // Prevent zoom or context menu
                        handleTap(e);
                    });
                }

                highlightCell(r, c) {
                    this.clearHint();
                    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) cell.classList.add('hint');
                }

                clearHint() {
                    document.querySelectorAll('.cell.hint').forEach(cell => cell.classList.remove('hint'));
                }
            }

            class GameController {
                constructor() {
                    this.game = new GameState();
                    this.ui = new UIManager(
                        this.game,
                        document.getElementById('gridContainer'),
                        document.getElementById('levelDisplay'),
                        document.getElementById('movesDisplay'),
                        document.getElementById('congratsMessage'),
                        document.getElementById('stuckMessage')
                    );
                    this.isAnimating = false;
                    this.undoStack = [];
                    this.maxUndo = 20;
                    this.nextLevelTimeout = null;
                    this.stuckFlag = false;

                    const saved = Storage.load();
                    if (saved) {
                        this.game.load(saved);
                    } else {
                        this.game.reset();
                    }

                    this.ui.render();
                    this.ui.bindEvents((r, c) => this.handleCellClick(r, c));
                    this.checkStuck();

                    document.getElementById('undoBtn').addEventListener('click', () => this.undo());
                    document.getElementById('hintBtn').addEventListener('click', () => this.hint());
                    document.getElementById('restartBtn').addEventListener('click', () => this.restart());
                    document.getElementById('nextBtn').addEventListener('click', () => this.nextLevel());

                    document.addEventListener('click', function unlockAudio() {
                        Sound.init();
                        document.removeEventListener('click', unlockAudio);
                    }, { once: true });
                }

                hasAnyMove() {
                    return this.game.hasAnyMove(this.game.grid);
                }

                checkStuck() {
                    if (this.game.winFlag) {
                        this.stuckFlag = false;
                        this.ui.showStuck(false);
                        return;
                    }
                    const movable = this.hasAnyMove();
                    this.stuckFlag = !movable;
                    this.ui.showStuck(!movable);
                }

                pushState() {
                    const state = {
                        grid: this.game.grid.map(row => [...row]),
                        moves: this.game.moves,
                        level: this.game.level,
                        size: this.game.size
                    };
                    this.undoStack.push(state);
                    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
                }

                undo() {
                    if (this.isAnimating || this.game.winFlag) return;
                    if (this.undoStack.length === 0) return;
                    const prev = this.undoStack.pop();
                    this.game.grid = prev.grid.map(row => [...row]);
                    this.game.moves = prev.moves;
                    this.game.level = prev.level;
                    this.game.size = prev.size;
                    this.game.winFlag = false;
                    this.ui.clearHint();
                    this.ui.render();
                    Storage.save(this.game);
                    this.ui.showCongrats(false);
                    if (this.nextLevelTimeout) {
                        clearTimeout(this.nextLevelTimeout);
                        this.nextLevelTimeout = null;
                    }
                    this.checkStuck();
                }

                hint() {
                    if (this.isAnimating || this.game.winFlag || this.stuckFlag) return;
                    this.ui.clearHint();

                    const validMoves = [];
                    for (let r = 0; r < this.game.size; r++) {
                        for (let c = 0; c < this.game.size; c++) {
                            if (this.game.grid[r][c] === null) continue;
                            const pathInfo = this.game.getMovePath(r, c);
                            if (pathInfo) {
                                if (pathInfo.path.length > 1 || (pathInfo.path.length === 1 && pathInfo.action === 'remove')) {
                                    validMoves.push({ r, c });
                                }
                            }
                        }
                    }

                    if (validMoves.length === 0) return;

                    const randomIndex = Math.floor(Math.random() * validMoves.length);
                    const { r, c } = validMoves[randomIndex];
                    this.ui.highlightCell(r, c);
                    setTimeout(() => this.ui.clearHint(), 2000);
                }

                handleCellClick(r, c) {
                    if (this.isAnimating || this.game.winFlag || this.stuckFlag) return;

                    const pathInfo = this.game.getMovePath(r, c);
                    if (!pathInfo) return;
                    const { path, action } = pathInfo;
                    if (path.length === 0) return;
                    if (path.length === 1 && action === 'stop') return;

                    this.pushState();
                    this.isAnimating = true;
                    this.ui.clearHint();

                    let stepIndex = 0;
                    const performStep = () => {
                        if (stepIndex < path.length - 1) {
                            const from = path[stepIndex];
                            const to = path[stepIndex + 1];
                            this.game.applyStep(from.r, from.c, to.r, to.c);
                            this.ui.render();
                            Sound.playMove();
                            stepIndex++;
                            setTimeout(performStep, 70);
                        } else {
                            if (action === 'remove') {
                                const last = path[path.length - 1];
                                this.game.applyStep(last.r, last.c, undefined, undefined);
                                this.ui.render();
                                Sound.playMove();
                            }
                            this.game.moves++;
                            this.ui.movesSpan.textContent = this.game.moves;
                            this.isAnimating = false;
                            Storage.save(this.game);

                            if (this.game.isWin()) {
                                this.game.winFlag = true;
                                Sound.playWin();
                                this.ui.showCongrats(true);
                                this.ui.showStuck(false);
                                this.nextLevelTimeout = setTimeout(() => {
                                    this.nextLevel();
                                }, 2000);
                            } else {
                                this.checkStuck();
                            }
                        }
                    };

                    if (path.length === 1 && action === 'remove') {
                        this.game.applyStep(r, c, undefined, undefined);
                        this.ui.render();
                        Sound.playMove();
                        this.game.moves++;
                        this.ui.movesSpan.textContent = this.game.moves;
                        this.isAnimating = false;
                        Storage.save(this.game);
                        if (this.game.isWin()) {
                            this.game.winFlag = true;
                            Sound.playWin();
                            this.ui.showCongrats(true);
                            this.ui.showStuck(false);
                            this.nextLevelTimeout = setTimeout(() => {
                                this.nextLevel();
                            }, 2000);
                        } else {
                            this.checkStuck();
                        }
                    } else {
                        performStep();
                    }
                }

                restart() {
                    if (this.isAnimating) return;
                    this.game.reset(true);
                    this.undoStack = [];
                    this.ui.clearHint();
                    this.ui.render();
                    this.ui.showCongrats(false);
                    this.ui.showStuck(false);
                    Storage.save(this.game);
                    if (this.nextLevelTimeout) {
                        clearTimeout(this.nextLevelTimeout);
                        this.nextLevelTimeout = null;
                    }
                    this.checkStuck();
                }

                nextLevel() {
                    if (this.isAnimating) return;
                    this.game.levelUp();
                    this.undoStack = [];
                    this.ui.clearHint();
                    this.ui.render();
                    this.ui.showCongrats(false);
                    this.ui.showStuck(false);
                    Storage.save(this.game);
                    if (this.nextLevelTimeout) {
                        clearTimeout(this.nextLevelTimeout);
                        this.nextLevelTimeout = null;
                    }
                    this.checkStuck();
                }
            }

            // Custom cursor
            const cursor = document.getElementById('cursor');
            if (cursor) {
                document.addEventListener('mousemove', (e) => {
                    cursor.style.left = e.clientX + 'px';
                    cursor.style.top = e.clientY + 'px';
                });
                const hoverEls = document.querySelectorAll('.btn, .cell');
                hoverEls.forEach(el => {
                    el.addEventListener('mouseenter', () => {
                        cursor.style.width = '60px';
                        cursor.style.height = '60px';
                        cursor.style.backgroundColor = '#FBFF48';
                        cursor.style.mixBlendMode = 'normal';
                        cursor.style.border = '2px solid black';
                    });
                    el.addEventListener('mouseleave', () => {
                        cursor.style.width = '24px';
                        cursor.style.height = '24px';
                        cursor.style.backgroundColor = 'white';
                        cursor.style.mixBlendMode = 'difference';
                        cursor.style.border = '2px solid black';
                    });
                });
            }

            window.addEventListener('DOMContentLoaded', () => {
                new GameController();
            });
        })();
>>>>>>> d3496fe49f41233c01500f8843ba1fb5ed788957
