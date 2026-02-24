// ============================================================
//  MARIO JS  –  Complete Game
//  Requirements covered:
//    ✅ requestAnimationFrame (proper usage, timestamp passed)
//    ✅ Performance measurement – live FPS counter + jank colour
//    ✅ Pause menu  (P / Esc)  →  Continue  |  Restart
//    ✅ Scoreboard  →  Timer  |  Score  |  Lives
//    ✅ Minimal layers  (CSS transform on player, not left/top)
//    ✅ Plain JS / DOM only – no frameworks, no canvas
//    ✅ Smooth held-key controls  (keydown→keyup state map)
// ============================================================

// ── Constants ────────────────────────────────────────────────
const GRAVITY     = 0.5;
const JUMP_FORCE  = -12;
const MOVE_SPEED  = 5;
const ENEMY_SPEED = 1;

// ── Performance tracking ─────────────────────────────────────
let lastFrameTime = 0;
let frameTimes    = [];          // rolling window of frame deltas
const FPS_SAMPLES = 60;          // average over last 60 frames

// ── Timers ───────────────────────────────────────────────────
let gameStartTime = 0;           // performance.now() at game start
let pausedAt      = 0;           // performance.now() when paused
let totalPausedMs = 0;           // cumulative ms spent paused

// ── Game state ────────────────────────────────────────────────
let gameState = {
    score:       0,
    level:       1,
    lives:       3,
    gameRunning: true,
    gamePaused:  false,
    keys:        {}
};

// ── Player ────────────────────────────────────────────────────
let player = {
    element:   document.getElementById('mario'),
    x:         50,
    y:         340,
    width:     20,
    height:    20,
    velocityX: 0,
    velocityY: 0,
    onGround:  false,
    big:       false,
    bigTimer:  0
};

// ── Game objects ──────────────────────────────────────────────
let gameObjects = {
    platforms:      [],
    enemies:        [],
    coins:          [],
    surpriseBlocks: [],
    pipes:          []
};

// ============================================================
//  LEVELS  (10 levels)
// ============================================================
const levels = [

    // ── Level 1 – Tutorial ───────────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 400, height: 40, type: 'ground'   },
            { x: 500, y: 360, width: 300, height: 40, type: 'ground'   },
            { x: 200, y: 280, width: 60,  height: 20, type: 'floating' },
            { x: 300, y: 240, width: 60,  height: 20, type: 'floating' },
            { x: 600, y: 280, width: 80,  height: 20, type: 'floating' }
        ],
        enemies: [
            { x: 250, y: 340, type: 'brown' },
            { x: 550, y: 340, type: 'brown' }
        ],
        coins: [
            { x: 220, y: 260 }, { x: 320, y: 220 }, { x: 620, y: 260 }
        ],
        surpriseBlocks: [ { x: 320, y: 180, type: 'mushroom' } ],
        pipes: [ { x: 750, y: 320 } ]
    },

    // ── Level 2 – Staircase ──────────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 200, height: 40, type: 'blue' },
            { x: 300, y: 360, width: 200, height: 40, type: 'blue' },
            { x: 600, y: 360, width: 200, height: 40, type: 'blue' },
            { x: 150, y: 300, width: 40,  height: 20, type: 'blue' },
            { x: 250, y: 270, width: 40,  height: 20, type: 'blue' },
            { x: 350, y: 240, width: 40,  height: 20, type: 'blue' },
            { x: 450, y: 210, width: 40,  height: 20, type: 'blue' },
            { x: 550, y: 240, width: 40,  height: 20, type: 'blue' }
        ],
        enemies: [
            { x: 320, y: 340, type: 'purple' },
            { x: 620, y: 340, type: 'purple' },
            { x: 460, y: 340, type: 'brown'  }
        ],
        coins: [
            { x: 165, y: 280 }, { x: 265, y: 250 }, { x: 365, y: 220 },
            { x: 465, y: 190 }, { x: 565, y: 220 }
        ],
        surpriseBlocks: [
            { x: 200, y: 250, type: 'coin'     },
            { x: 400, y: 210, type: 'mushroom' }
        ],
        pipes: [ { x: 750, y: 320 } ]
    },

    // ── Level 3 – Island Hopping ─────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 120, height: 40, type: 'red' },
            { x: 180, y: 360, width: 80,  height: 40, type: 'red' },
            { x: 330, y: 360, width: 80,  height: 40, type: 'red' },
            { x: 480, y: 360, width: 80,  height: 40, type: 'red' },
            { x: 630, y: 360, width: 170, height: 40, type: 'red' },
            { x: 100, y: 280, width: 60,  height: 20, type: 'red' },
            { x: 280, y: 240, width: 60,  height: 20, type: 'red' },
            { x: 460, y: 200, width: 60,  height: 20, type: 'red' },
            { x: 620, y: 260, width: 60,  height: 20, type: 'red' }
        ],
        enemies: [
            { x: 190, y: 340, type: 'red'  }, { x: 340, y: 340, type: 'red'  },
            { x: 490, y: 340, type: 'red' }, { x: 640, y: 340, type: 'red' }
        ],
        coins: [
            { x: 115, y: 260 }, { x: 295, y: 220 }, { x: 475, y: 180 },
            { x: 635, y: 240 }, { x: 700, y: 340 }
        ],
        surpriseBlocks: [
            { x: 280, y: 180, type: 'mushroom' },
            { x: 500, y: 160, type: 'coin'     }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 4 – Underground ────────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 800, height: 40, type: 'blue' },
            { x: 80,  y: 300, width: 80,  height: 20, type: 'blue' },
            { x: 220, y: 260, width: 80,  height: 20, type: 'blue' },
            { x: 360, y: 220, width: 80,  height: 20, type: 'blue' },
            { x: 500, y: 260, width: 80,  height: 20, type: 'blue' },
            { x: 640, y: 300, width: 80,  height: 20, type: 'blue' },
            { x: 160, y: 180, width: 60,  height: 20, type: 'blue' },
            { x: 460, y: 160, width: 60,  height: 20, type: 'blue' }
        ],
        enemies: [
            { x: 100, y: 340, type: 'orange' }, { x: 230, y: 340, type: 'red' },
            { x: 380, y: 340, type: 'orange' }, { x: 520, y: 340, type: 'brown'  },
            { x: 650, y: 340, type: 'brown'  }, { x: 370, y: 204, type: 'orange'  }
        ],
        coins: [
            { x: 95,  y: 280 }, { x: 235, y: 240 }, { x: 375, y: 200 },
            { x: 515, y: 240 }, { x: 655, y: 280 }, { x: 175, y: 160 },
            { x: 475, y: 140 }
        ],
        surpriseBlocks: [
            { x: 140, y: 160, type: 'coin'     },
            { x: 360, y: 140, type: 'mushroom' },
            { x: 560, y: 200, type: 'coin'     }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 5 – Gauntlet ───────────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 100, height: 40, type: 'red' },
            { x: 160, y: 320, width: 60,  height: 20, type: 'red' },
            { x: 280, y: 280, width: 60,  height: 20, type: 'red' },
            { x: 400, y: 240, width: 60,  height: 20, type: 'red' },
            { x: 520, y: 200, width: 60,  height: 20, type: 'red' },
            { x: 640, y: 240, width: 60,  height: 20, type: 'red' },
            { x: 680, y: 360, width: 120, height: 40, type: 'red' },
            { x: 200, y: 200, width: 40,  height: 20, type: 'red' },
            { x: 460, y: 160, width: 40,  height: 20, type: 'red' }
        ],
        enemies: [
            { x: 170, y: 304, type: 'red' }, { x: 290, y: 264, type: 'purple' },
            { x: 410, y: 224, type: 'purple' }, { x: 530, y: 184, type: 'orange' },
            { x: 650, y: 224, type: 'orange' }, { x: 690, y: 340, type: 'brown'  },
            { x: 730, y: 340, type: 'brown'  }
        ],
        coins: [
            { x: 175, y: 300 }, { x: 295, y: 260 }, { x: 415, y: 220 },
            { x: 535, y: 180 }, { x: 655, y: 220 }, { x: 215, y: 180 },
            { x: 475, y: 140 }
        ],
        surpriseBlocks: [
            { x: 200, y: 160, type: 'mushroom' },
            { x: 400, y: 180, type: 'coin'     },
            { x: 600, y: 180, type: 'mushroom' }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 6 – Zigzag Canyon ──────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 150, height: 40, type: 'ground'   },
            { x: 220, y: 300, width: 80,  height: 20, type: 'floating' },
            { x: 370, y: 340, width: 80,  height: 20, type: 'floating' },
            { x: 520, y: 280, width: 80,  height: 20, type: 'floating' },
            { x: 660, y: 360, width: 140, height: 40, type: 'ground'   },
            { x: 100, y: 230, width: 60,  height: 20, type: 'floating' },
            { x: 290, y: 210, width: 60,  height: 20, type: 'floating' },
            { x: 450, y: 190, width: 60,  height: 20, type: 'floating' },
            { x: 600, y: 210, width: 60,  height: 20, type: 'floating' }
        ],
        enemies: [
            { x: 230, y: 284, type: 'brown'  }, { x: 380, y: 324, type: 'red'  },
            { x: 530, y: 264, type: 'orange' }, { x: 670, y: 344, type: 'purple' },
            { x: 460, y: 174, type: 'orange'  }
        ],
        coins: [
            { x: 115, y: 210 }, { x: 305, y: 190 }, { x: 465, y: 170 },
            { x: 615, y: 190 }, { x: 240, y: 280 }, { x: 535, y: 260 }
        ],
        surpriseBlocks: [
            { x: 100, y: 180, type: 'coin'     },
            { x: 450, y: 150, type: 'mushroom' },
            { x: 620, y: 170, type: 'coin'     }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 7 – Twin Towers ────────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 800, height: 40, type: 'blue' },
            { x: 80,  y: 300, width: 60,  height: 20, type: 'blue' },
            { x: 80,  y: 240, width: 60,  height: 20, type: 'blue' },
            { x: 80,  y: 180, width: 60,  height: 20, type: 'blue' },
            { x: 200, y: 180, width: 160, height: 20, type: 'blue' },
            { x: 420, y: 300, width: 60,  height: 20, type: 'blue' },
            { x: 420, y: 240, width: 60,  height: 20, type: 'blue' },
            { x: 420, y: 180, width: 60,  height: 20, type: 'blue' },
            { x: 580, y: 280, width: 100, height: 20, type: 'blue' },
            { x: 680, y: 220, width: 80,  height: 20, type: 'blue' }
        ],
        enemies: [
            { x: 90,  y: 284, type: 'orange' }, { x: 90,  y: 224, type: 'orange' },
            { x: 210, y: 164, type: 'red'  }, { x: 310, y: 164, type: 'red'  },
            { x: 430, y: 284, type: 'orange' }, { x: 590, y: 264, type: 'red'  },
            { x: 690, y: 204, type: 'orange' }
        ],
        coins: [
            { x: 95,  y: 260 }, { x: 95,  y: 160 }, { x: 250, y: 160 },
            { x: 320, y: 160 }, { x: 435, y: 160 }, { x: 595, y: 260 },
            { x: 700, y: 200 }
        ],
        surpriseBlocks: [
            { x: 140, y: 180, type: 'coin'     },
            { x: 360, y: 180, type: 'mushroom' },
            { x: 680, y: 180, type: 'coin'     }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 8 – Serpent Path ───────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 100, height: 40, type: 'red' },
            { x: 160, y: 330, width: 80,  height: 20, type: 'red' },
            { x: 300, y: 300, width: 80,  height: 20, type: 'red' },
            { x: 440, y: 270, width: 80,  height: 20, type: 'red' },
            { x: 580, y: 240, width: 80,  height: 20, type: 'red' },
            { x: 680, y: 360, width: 120, height: 40, type: 'red' },
            { x: 100, y: 240, width: 80,  height: 20, type: 'red' },
            { x: 240, y: 210, width: 80,  height: 20, type: 'red' },
            { x: 380, y: 180, width: 80,  height: 20, type: 'red' },
            { x: 520, y: 150, width: 80,  height: 20, type: 'red' }
        ],
        enemies: [
            { x: 170, y: 314, type: 'brown'  }, { x: 310, y: 284, type: 'purple' },
            { x: 450, y: 254, type: 'purple' }, { x: 590, y: 224, type: 'brown'  },
            { x: 110, y: 224, type: 'brown'  }, { x: 390, y: 164, type: 'purple' },
            { x: 530, y: 134, type: 'purple' }
        ],
        coins: [
            { x: 185, y: 310 }, { x: 325, y: 280 }, { x: 465, y: 250 },
            { x: 605, y: 220 }, { x: 255, y: 190 }, { x: 395, y: 160 },
            { x: 545, y: 130 }
        ],
        surpriseBlocks: [
            { x: 160, y: 200, type: 'mushroom' },
            { x: 380, y: 140, type: 'coin'     },
            { x: 560, y: 110, type: 'mushroom' }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 9 – Checkerboard ───────────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 800, height: 40, type: 'blue' },
            { x: 60,  y: 310, width: 50,  height: 20, type: 'blue' },
            { x: 180, y: 310, width: 50,  height: 20, type: 'blue' },
            { x: 300, y: 310, width: 50,  height: 20, type: 'blue' },
            { x: 420, y: 310, width: 50,  height: 20, type: 'blue' },
            { x: 540, y: 310, width: 50,  height: 20, type: 'blue' },
            { x: 660, y: 310, width: 50,  height: 20, type: 'blue' },
            { x: 120, y: 250, width: 50,  height: 20, type: 'blue' },
            { x: 240, y: 250, width: 50,  height: 20, type: 'blue' },
            { x: 360, y: 250, width: 50,  height: 20, type: 'blue' },
            { x: 480, y: 250, width: 50,  height: 20, type: 'blue' },
            { x: 600, y: 250, width: 50,  height: 20, type: 'blue' },
            { x: 60,  y: 190, width: 50,  height: 20, type: 'blue' },
            { x: 300, y: 190, width: 50,  height: 20, type: 'blue' },
            { x: 540, y: 190, width: 50,  height: 20, type: 'blue' }
        ],
        enemies: [
            { x: 65,  y: 294, type: 'brown'  }, { x: 185, y: 294, type: 'orange' },
            { x: 305, y: 294, type: 'red'  }, { x: 425, y: 294, type: 'purple' },
            { x: 545, y: 294, type: 'brown'  }, { x: 125, y: 234, type: 'orange' },
            { x: 365, y: 234, type: 'red'  }, { x: 605, y: 234, type: 'purple' }
        ],
        coins: [
            { x: 75,  y: 290 }, { x: 195, y: 290 }, { x: 315, y: 290 },
            { x: 435, y: 290 }, { x: 555, y: 290 }, { x: 135, y: 230 },
            { x: 375, y: 230 }, { x: 615, y: 230 }, { x: 75,  y: 170 },
            { x: 315, y: 170 }, { x: 555, y: 170 }
        ],
        surpriseBlocks: [
            { x: 240, y: 210, type: 'coin'     },
            { x: 480, y: 210, type: 'mushroom' },
            { x: 300, y: 150, type: 'coin'     }
        ],
        pipes: [ { x: 740, y: 320 } ]
    },

    // ── Level 10 – Final Boss Rush ───────────────────────────
    {
        platforms: [
            { x: 0,   y: 360, width: 140, height: 40, type: 'red' },
            { x: 200, y: 340, width: 60,  height: 20, type: 'red' },
            { x: 320, y: 310, width: 60,  height: 20, type: 'red' },
            { x: 440, y: 280, width: 60,  height: 20, type: 'red' },
            { x: 560, y: 250, width: 60,  height: 20, type: 'red' },
            { x: 660, y: 360, width: 140, height: 40, type: 'red' },
            { x: 140, y: 240, width: 60,  height: 20, type: 'red' },
            { x: 280, y: 210, width: 60,  height: 20, type: 'red' },
            { x: 420, y: 180, width: 60,  height: 20, type: 'red' },
            { x: 560, y: 150, width: 60,  height: 20, type: 'red' },
            { x: 680, y: 200, width: 80,  height: 20, type: 'red' }
        ],
        enemies: [
            { x: 210, y: 324, type: 'orange' }, { x: 330, y: 294, type: 'red' },
            { x: 450, y: 264, type: 'orange' }, { x: 570, y: 234, type: 'purple' },
            { x: 670, y: 344, type: 'orange' }, { x: 710, y: 344, type: 'brown'  },
            { x: 150, y: 224, type: 'red'  }, { x: 290, y: 194, type: 'brown'  },
            { x: 430, y: 164, type: 'purple' }, { x: 570, y: 134, type: 'purple' },
            { x: 690, y: 184, type: 'red'  }
        ],
        coins: [
            { x: 215, y: 320 }, { x: 335, y: 290 }, { x: 455, y: 260 },
            { x: 575, y: 230 }, { x: 155, y: 220 }, { x: 295, y: 190 },
            { x: 435, y: 160 }, { x: 575, y: 130 }, { x: 695, y: 180 },
            { x: 700, y: 340 }
        ],
        surpriseBlocks: [
            { x: 140, y: 200, type: 'mushroom' },
            { x: 360, y: 170, type: 'coin'     },
            { x: 500, y: 140, type: 'mushroom' },
            { x: 660, y: 160, type: 'coin'     }
        ],
        pipes: [ { x: 740, y: 320 } ]
    }
];

// ============================================================
//  INIT
// ============================================================
function initGame() {
    gameStartTime = performance.now();
    lastFrameTime = performance.now();
    totalPausedMs = 0;
    frameTimes    = [];
    loadLevel(gameState.level - 1);
    requestAnimationFrame(gameLoop);
}

// ============================================================
//  LOAD LEVEL
// ============================================================
function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) { showGameOver(true); return; }

    clearLevel();

    const level    = levels[levelIndex];
    const gameArea = document.getElementById('game-area');

    // Reset player  (BUG FIX: was player.Big — capital B = never reset)
    player.x = 50; player.y = 340;
    player.velocityX = 0; player.velocityY = 0;
    player.onGround = false;
    player.big = false; player.bigTimer = 0;
    player.element.className = '';
    setTransform(player.element, player.x, player.y);

    // Platforms
    level.platforms.forEach((pd, i) => {
        const el = createElement('div', `platform ${pd.type}`, {
            left: pd.x + 'px', top: pd.y + 'px',
            width: pd.width + 'px', height: pd.height + 'px'
        });
        gameArea.appendChild(el);
        gameObjects.platforms.push({ element: el, ...pd, id: 'platform-' + i });
    });

    // Enemies
    level.enemies.forEach((ed, i) => {
        const el = createElement('div', `enemy ${ed.type}`, {
            left: ed.x + 'px', top: ed.y + 'px'
        });
        gameArea.appendChild(el);
        gameObjects.enemies.push({
            element: el, x: ed.x, y: ed.y, width: 20, height: 20,
            direction: -1, speed: ENEMY_SPEED, id: 'enemy-' + i, alive: true
        });
    });

    // Coins
    level.coins.forEach((cd, i) => {
        const el = createElement('div', 'coin', { left: cd.x + 'px', top: cd.y + 'px' });
        gameArea.appendChild(el);
        gameObjects.coins.push({
            element: el, x: cd.x, y: cd.y, width: 20, height: 20,
            collected: false, id: 'coin-' + i
        });
    });

    // Surprise blocks
    level.surpriseBlocks.forEach((bd, i) => {
        const el = createElement('div', 'surprise-block', { left: bd.x + 'px', top: bd.y + 'px' });
        gameArea.appendChild(el);
        gameObjects.surpriseBlocks.push({
            element: el, x: bd.x, y: bd.y, width: 20, height: 20,
            type: bd.type, hit: false, id: 'block-' + i
        });
    });

    // Pipes
    level.pipes.forEach((pd, i) => {
        const pipe = createElement('div', 'pipe', { left: pd.x + 'px', top: pd.y + 'px' });
        pipe.append(
            createElement('div', 'pipe-top'),
            createElement('div', 'pipe-top-right'),
            createElement('div', 'pipe-bottom'),
            createElement('div', 'pipe-bottom-right')
        );
        gameArea.appendChild(pipe);
        gameObjects.pipes.push({ element: pipe, x: pd.x, y: pd.y, width: 40, height: 40, id: 'pipe-' + i });
    });
}

// ============================================================
//  HELPERS
// ============================================================

/**
 * setTransform  –  moves an element using CSS transform:translate()
 * instead of changing left/top.  This keeps the browser in the
 * COMPOSITE step only (GPU), skipping Layout and Paint entirely.
 * The element must have  left:0; top:0  set in CSS.
 *
 * WHY THIS MATTERS FOR 60 FPS:
 *   left/top  → triggers Layout → Paint → Composite  (slow)
 *   transform → skips to Composite only              (fast, no jank)
 */
function setTransform(el, x, y) {
    el.style.transform = `translate(${x}px,${y}px)`;
}

function createElement(type, className, styles = {}) {
    const el = document.createElement(type);
    el.className = className;
    Object.assign(el.style, styles);
    return el;
}

function clearLevel() {
    Object.values(gameObjects).flat().forEach(obj => {
        if (obj.element?.parentNode) obj.element.remove();
    });
    gameObjects = { platforms: [], enemies: [], coins: [], surpriseBlocks: [], pipes: [] };
}

function showGameOver(won) {
    gameState.gameRunning = false;
    document.getElementById('game-over-title').textContent =
        won ? '🎉 Congratulations! You Won!' : '💀 Game Over';
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('game-over').style.display = 'flex';
}

// ============================================================
//  PAUSE MENU
// ============================================================
function togglePause() {
    if (!gameState.gameRunning) return;

    gameState.gamePaused = !gameState.gamePaused;
    document.getElementById('pause-menu').style.display =
        gameState.gamePaused ? 'flex' : 'none';

    if (gameState.gamePaused) {
        // Record when we paused
        pausedAt = performance.now();
        // NOTE: we do NOT call requestAnimationFrame here.
        // The loop naturally stops because gameLoop returns early.
        // This means ZERO CPU/GPU cost while paused.
    } else {
        // Add the duration we were paused to the running total
        totalPausedMs += performance.now() - pausedAt;
        // Re-anchor lastFrameTime so the FPS delta doesn't spike
        lastFrameTime = performance.now();
        // Restart the animation loop
        requestAnimationFrame(gameLoop);
    }
}

document.getElementById('pause-continue').addEventListener('click', () => {
    if (gameState.gamePaused) togglePause();
});

document.getElementById('pause-restart').addEventListener('click', () => {
    document.getElementById('pause-menu').style.display = 'none';
    gameState.gamePaused = false;
    restartGame();
});

// ============================================================
//  INPUT  –  smooth held-key via keydown/keyup state map
//  Pressing and HOLDING a key keeps the action going every frame.
//  Releasing immediately stops it. No key-repeat delay or spam needed.
// ============================================================
document.addEventListener('keydown', (e) => {
    gameState.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.code] = false;
});

// ============================================================
//  GAME LOOP  –  requestAnimationFrame with timestamp
//
//  The browser passes a DOMHighResTimeStamp to the callback.
//  We use this to compute an accurate frame delta for FPS tracking.
//  We do NOT call gameLoop() ourselves — only rAF does.
// ============================================================
function gameLoop(timestamp) {
    if (!gameState.gameRunning) return;   // stop loop after game over
    if (gameState.gamePaused)   return;   // stop loop while paused — no wasted frames

    // ── FPS measurement ──────────────────────────────────────
    const delta   = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // Rolling average over the last FPS_SAMPLES frames
    frameTimes.push(delta);
    if (frameTimes.length > FPS_SAMPLES) frameTimes.shift();
    const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps      = Math.round(1000 / avgDelta);

    // Colour-coded FPS badge: green ≥55, yellow ≥30, red = jank
    const fpsEl = document.getElementById('fps');
    if (fpsEl) {
        fpsEl.textContent = fps;
        fpsEl.style.color = fps >= 55 ? '#00ff88'
                          : fps >= 30 ? '#ffcc00'
                          :             '#ff4444';
    }

    update();
    requestAnimationFrame(gameLoop);   // schedule next frame
}

// ============================================================
//  UPDATE  –  all game logic runs once per frame
// ============================================================
function update() {

    // ── Horizontal movement ───────────────────────────────────
    if (gameState.keys['ArrowLeft'] || gameState.keys['KeyA']) {
        player.velocityX = -MOVE_SPEED;
    } else if (gameState.keys['ArrowRight'] || gameState.keys['KeyD']) {
        player.velocityX = MOVE_SPEED;
    } else {
        player.velocityX *= 0.8;   // smooth deceleration when key released
    }

    // ── Jump (only when on ground — no double-jump) ───────────
    if ((gameState.keys['Space'] || gameState.keys['ArrowUp'] || gameState.keys['KeyW'])
            && player.onGround) {
        player.velocityY = JUMP_FORCE;
        player.onGround  = false;
    }

    // ── Gravity ───────────────────────────────────────────────
    if (!player.onGround) player.velocityY += GRAVITY;

    player.x += player.velocityX;
    player.y += player.velocityY;
    player.onGround = false;

    // ── Platform collision ────────────────────────────────────
    for (const platform of gameObjects.platforms) {
        if (checkCollision(player, platform) && player.velocityY > 0) {
            player.y         = platform.y - player.height;
            player.velocityY = 0;
            player.onGround  = true;
        }
    }

    // ── Pipe top collision (solid surface) ───────────────────
    for (const pipe of gameObjects.pipes) {
        if (checkCollision(player, pipe) && player.velocityY > 0) {
            player.y         = pipe.y - player.height;
            player.velocityY = 0;
            player.onGround  = true;
        }
    }

    // ── Enemy movement & collision ────────────────────────────
    for (const enemy of gameObjects.enemies) {
        if (!enemy.alive) continue;

        enemy.x += enemy.speed * enemy.direction;

        // Reverse direction if off a platform edge or at world boundary
        let onPlatform = false;
        for (const platform of gameObjects.platforms) {
            if (enemy.x + enemy.width > platform.x &&
                enemy.x < platform.x + platform.width &&
                enemy.y + enemy.height >= platform.y - 5 &&
                enemy.y + enemy.height <= platform.y + 5) {
                onPlatform = true;
                break;
            }
        }
        if (!onPlatform || enemy.x <= 0 || enemy.x >= 800) enemy.direction *= -1;

        enemy.element.style.left = enemy.x + 'px';
        enemy.element.style.top  = enemy.y + 'px';

        // Player-enemy collision
        if (checkCollision(player, enemy)) {
            if (player.velocityY > 0 && player.y < enemy.y) {
                // Stomp
                enemy.alive = false;
                enemy.element.remove();
                player.velocityY  = JUMP_FORCE * 0.7;
                gameState.score  += 100;
            } else if (player.big) {
                // Shrink instead of dying
                player.big      = false;
                player.bigTimer = 0;
                player.element.classList.remove('big');
                player.width = 20; player.height = 20;
            } else if (player.onGround) {
                loseLife();
            }
        }
    }

    // ── Coin collection ───────────────────────────────────────
    for (const coin of gameObjects.coins) {
        if (!coin.collected && checkCollision(player, coin)) {
            coin.collected = true;
            coin.element.remove();
            gameState.score += 50;
        }
    }

    // ── Surprise blocks ───────────────────────────────────────
    for (const block of gameObjects.surpriseBlocks) {
        if (!block.hit && checkCollision(player, block) && player.velocityY < 0) {
            block.hit = true;
            block.element.classList.add('hit');
            spawnItemOnBox(block, block.type);

            if (block.type === 'mushroom') {
                player.big = true; player.bigTimer = 600;
                player.element.classList.add('big');
                player.width = 40; player.height = 40;
                gameState.score += 100;
            } else if (block.type === 'coin') {   // BUG FIX: was ' coin' (leading space)
                gameState.score += 50;
            }
        }
    }

    // ── Pipe → advance to next level ─────────────────────────
    for (const pipe of gameObjects.pipes) {
        if (player.onGround &&
            player.x + player.width > pipe.x &&
            player.x < pipe.x + pipe.width &&
            Math.abs(player.y + player.height - pipe.y) < 5 &&
            (gameState.keys['ArrowDown'] || gameState.keys['KeyS'])) {
            nextLevel();
        }
    }

    // ── Fall death ────────────────────────────────────────────
    if (player.y > 400) loseLife();

    // ── Render player using transform (GPU compositing only) ──
    setTransform(player.element, player.x, player.y);

    // ── HUD ───────────────────────────────────────────────────
    document.getElementById('score').textContent  = gameState.score;
    document.getElementById('levels').textContent = gameState.level;
    document.getElementById('lives').textContent  = gameState.lives;

    // Timer: real elapsed time minus any time spent in pause menu
    const elapsed = Math.floor(
        (performance.now() - gameStartTime - totalPausedMs) / 1000
    );
    document.getElementById('time').textContent = elapsed;
}

// ============================================================
//  COLLISION  (AABB)
// ============================================================
function checkCollision(a, b) {
    return a.x < b.x + b.width  &&
           a.x + a.width  > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// ============================================================
//  ITEM SPAWN  (mushroom falls, coin floats up)
// ============================================================
function spawnItemOnBox(block, type) {
    const gameArea = document.getElementById('game-area');
    const item     = document.createElement('div');
    item.classList.add(type);
    item.style.left = block.x + 'px';
    item.style.top  = (block.y - 20) + 'px';
    gameArea.appendChild(item);

    const obj = {
        x: block.x, y: block.y - 20,
        width: 20, height: 20,
        element: item, velocityY: 0, frames: 0
    };

    if (type === 'mushroom') {
        (function fall() {
            obj.velocityY += GRAVITY;
            obj.y         += obj.velocityY;
            let landed = false;
            for (const platform of gameObjects.platforms) {
                if (obj.x < platform.x + platform.width &&
                    obj.x + obj.width > platform.x &&
                    obj.y + obj.height >= platform.y &&
                    obj.y + obj.height <= platform.y + 5) {
                    landed        = true;
                    obj.y         = platform.y - obj.height;
                    obj.velocityY = 0;
                    item.remove();
                    break;
                }
            }
            item.style.top = obj.y + 'px';
            if (!landed) requestAnimationFrame(fall);
        })();

    } else if (type === 'coin') {
        // BUG FIX: was `frames >= 180` which ran the animation forever
        (function floatUp() {
            obj.y -= 1;
            item.style.top = obj.y + 'px';
            obj.frames++;
            if (obj.frames < 30) requestAnimationFrame(floatUp);
            else item.remove();
        })();
    }
}

// ============================================================
//  LIFE / LEVEL
// ============================================================
function loseLife() {
    gameState.lives--;
    if (gameState.lives <= 0) {
        showGameOver(false);
    } else {
        player.x = 50; player.y = 340;
        player.velocityX = 0; player.velocityY = 0;
        player.big = false; player.bigTimer = 0;
        player.element.classList.remove('big');
        player.width = 20; player.height = 20;
    }
}

function nextLevel() {
    gameState.level++;
    if (gameState.level > levels.length) {
        showGameOver(true);
    } else {
        player.element.classList.remove('big');
        player.width = 20; player.height = 20;
        loadLevel(gameState.level - 1);
    }
}

// ============================================================
//  RESTART
// ============================================================
function restartGame() {
    gameStartTime = performance.now();
    lastFrameTime = performance.now();
    totalPausedMs = 0;
    frameTimes    = [];

    gameState = { score: 0, level: 1, lives: 3, gameRunning: true, gamePaused: false, keys: {} };
    player.big = false; player.bigTimer = 0;
    player.element.classList.remove('big');
    player.width = 20; player.height = 20;

    document.getElementById('game-over').style.display  = 'none';
    document.getElementById('pause-menu').style.display = 'none';
    initGame();
}

document.getElementById('restart-button').addEventListener('click', restartGame);

// ── Start ─────────────────────────────────────────────────────
initGame();