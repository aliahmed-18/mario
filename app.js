// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
let gameStartTime = 0;
const MOVE_SPEED = 5;
const ENEMY_SPEED = 1;

// Game state
let gameState = {
    score: 0,
    level: 1,
    lives: 3,
    gameRunning: true,
    keys: {}
}




// Player object
let player = {
    element: document.getElementById('mario'),
    x: 50,
    y: 340,
    width: 20,
    height: 20,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
    big: false,
    bigTimer: 0
}

// Game objects arrays
let gameObjects = {
    platforms: [],
    enemies: [],
    coins: [],
    surpriseBlocks: [],
    pipes: []
}

// Levels
const levels = [
    // level 1
    {
        platforms: [
            { x: 0, y: 360, width: 400, height: 40, type: 'ground' },
            { x: 500, y: 360, width: 300, height: 40, type: 'ground' },
            { x: 200, y: 280, width: 60, height: 20, type: 'floating' },
            { x: 300, y: 240, width: 60, height: 20, type: 'floating' },
            { x: 600, y: 280, width: 80, height: 20, type: 'floating' }
        ],
        enemies: [
            { x: 250, y: 340, type: 'brown' },
            { x: 550, y: 340, type: 'brown' }
        ],
        coins: [
            { x: 220, y: 260 },
            { x: 320, y: 220 },
            { x: 620, y: 260 }
        ],
        surpriseBlocks: [
            { x: 320, y: 180, type: 'mushroom' }
        ],
        pipes: [
            { x: 750, y: 320 }
        ]
    },
    // level 2
    {
        platforms: [
            { x: 0, y: 360, width: 200, height: 40, type: 'blue' },
            { x: 300, y: 360, width: 200, height: 40, type: 'blue' },
            { x: 600, y: 360, width: 200, height: 40, type: 'blue' },
            { x: 150, y: 300, width: 40, height: 20, type: 'blue' },
            { x: 250, y: 280, width: 40, height: 20, type: 'blue' },
            { x: 350, y: 260, width: 40, height: 20, type: 'blue' },
            { x: 450, y: 240, width: 40, height: 20, type: 'blue' },
            { x: 550, y: 280, width: 40, height: 20, type: 'blue' }

        ],
        enemies: [
            { x: 350, y: 344, type: 'purple' },
            { x: 650, y: 344, type: 'purple' },
            { x: 570, y: 344, type: 'purple' }
        ],
        coins: [
            { x: 170, y: 280 },
            { x: 270, y: 260 },
            { x: 370, y: 240 },
            { x: 470, y: 220 },
            { x: 570, y: 260 }
        ],
        surpriseBlocks: [
            { x: 200, y: 260, type: 'coin' },
            { x: 400, y: 220, type: 'mushroom' }
        ],
        pipes: [
            { x: 750, y: 320 }
        ]
    },
    // level 3
    {
        platforms: [
            { x: 0, y: 360, width: 200, height: 40, type: 'red' },
            { x: 300, y: 360, width: 200, height: 40, type: 'red' },
            { x: 600, y: 360, width: 200, height: 40, type: 'red' },
            { x: 150, y: 300, width: 40, height: 20, type: 'red' },
            { x: 250, y: 280, width: 40, height: 20, type: 'red' },
            { x: 350, y: 260, width: 40, height: 20, type: 'red' },
            { x: 450, y: 240, width: 40, height: 20, type: 'red' },
            { x: 550, y: 280, width: 40, height: 20, type: 'red' }

        ],
        enemies: [
            { x: 350, y: 344, type: 'purple' },
            { x: 650, y: 344, type: 'purple' },
            { x: 570, y: 344, type: 'purple' }
        ],
        coins: [
            { x: 170, y: 280 },
            { x: 270, y: 260 },
            { x: 370, y: 240 },
            { x: 470, y: 220 },
            { x: 570, y: 260 }
        ],
        surpriseBlocks: [
            { x: 200, y: 260, type: 'coin' },
            { x: 400, y: 220, type: 'mushroom' }
        ],
        pipes: [
            { x: 750, y: 320 }
        ]
    }

]

// Initialize game
function initGame() {
    gameStartTime = Date.now();
    loadLevel(gameState.level - 1);
    gameLoop();
}

function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) {
        shownGameOver(true)
        return;
    }

    // Clear existing objects
    clerLevel()

    const level = levels[levelIndex];
    const gameArea = document.getElementById('game-area');

    // Rest player
    player.x = 50;
    player.y = 340;
    player.velocityX = 0;
    player.velocityY = 0;
    player.onGround = false;
    player.big = false;
    player.bigTimer = 0;
    player.element.className = '';
    updateElementPosition(player.element, player.x, player.y);

    // Create platforms
    level.platforms.forEach((platformData, index) => {
        const platform = createElement('div', `platform ${platformData.type}`, {
            left: platformData.x + 'px',
            top: platformData.y + 'px',
            width: platformData.width + 'px',
            height: platformData.height + 'px'
        });
        gameArea.appendChild(platform);
        gameObjects.platforms.push({
            element: platform,
            ...platformData,
            id: 'platform-' + index
        });

    })

    // Create enemies
    level.enemies.forEach((enemyData, index) => {
        const enemy = createElement('div', `enemy ${enemyData.type}`, {
            left: enemyData.x + 'px',
            top: enemyData.y + 'px',
        })
        gameArea.appendChild(enemy)
        gameObjects.enemies.push({
            element: enemy,
            x: enemyData.x,
            y: enemyData.y,
            width: 20,
            height: 20,
            direction: -1,
            speed: ENEMY_SPEED,
            id: 'enemy-' + index,
            alive: true
        })
    })

    // Create coins
    level.coins.forEach((coinData, index) => {
        const coin = createElement('div', 'coin', {
            left: coinData.x + 'px',
            top: coinData.y + 'px',
        })
        gameArea.appendChild(coin)
        gameObjects.coins.push({
            element: coin,
            x: coinData.x,
            y: coinData.y,
            width: 20,
            height: 20,
            collected: false,
            speed: ENEMY_SPEED,
            id: 'coin-' + index
        })
    })

    // Create suprise blocks
    level.surpriseBlocks.forEach((blockData, index) => {
        const block = createElement('div', 'surprise-block', {
            left: blockData.x + 'px',
            top: blockData.y + 'px',
        })
        gameArea.appendChild(block)
        gameObjects.surpriseBlocks.push({
            element: block,
            x: blockData.x,
            y: blockData.y,
            width: 20,
            height: 20,
            type: blockData.type,
            hit: false,
            id: 'block-' + index
        })
    })

    // Create pipes
    level.pipes.forEach((pipeData, index) => {
        const pipe = createElement('div', 'pipe', {
            left: pipeData.x + 'px',
            top: pipeData.y + 'px',
        })
        const pipeTopLeft = createElement('div', 'pipe-top')
        const pipeTopRight = createElement('div', 'pipe-top-right')
        const pipeBottomLeft = createElement('div', 'pipe-bottom')
        const pipeBottomRight = createElement('div', 'pipe-bottom-right')

        pipe.append(pipeTopLeft, pipeTopRight, pipeBottomLeft, pipeBottomRight)

        gameArea.appendChild(pipe)
        gameObjects.pipes.push({
            element: pipe,
            x: pipeData.x,
            y: pipeData.y,
            width: 40,
            height: 40,
            id: 'pipe-' + index
        })
    })
}

function updateElementPosition(element, x, y) {
    element.style.left = x + 'px';
    element.style.top = y + 'px';
}

function createElement(type, className, styles = {}) {
    const element = document.createElement(type);
    element.className = className;
    Object.assign(element.style, styles);
    return element;
}

function shownGameOver(won) {
    gameState.gameRunning = false;
    document.getElementById('game-over-title').textContent = won ? 'Congratulations! You Won!' : 'Game Over';
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('game-over').style.display = 'block';
}

function clerLevel() {
    const gameArea = document.getElementById('game-area');

    Object.values(gameObjects).flat().forEach(obj => {
        if (obj.element && obj.element.parentNode) {
            obj.element.remove();
        }
    })

    gameObjects = {
        platforms: [],
        enemies: [],
        coins: [],
        surpriseBlocks: [],
        pipes: []
    }
}

// Input handling
document.addEventListener('keydown', (e) => {
    gameState.keys[e.code] = true;

    if (e.code === "Space") {
        e.preventDefault()
    }
})

document.addEventListener('keyup', (e) => {
    gameState.keys[e.code] = false;
})

// Game loop
function gameLoop() {
    if (!gameState.gameRunning) return;
    
    if (!gameState.gamePaused) {
        update();
    }
    
    requestAnimationFrame(gameLoop)
}

// Update game logic
function update() {
    // console.log(gameState.keys)
    // Handles left and right
    if (gameState.keys['ArrowLeft'] || gameState.keys['KeyA']) {
        player.velocityX = -MOVE_SPEED;
    } else if (gameState.keys['ArrowRight'] || gameState.keys['KeyD']) {
        player.velocityX = MOVE_SPEED;
    } else {
        player.velocityX *= 0.8
    }

    // Handle jumping
    if ((gameState.keys['Space'] || gameState.keys['ArrowUp'] || gameState.keys['KeyW']) && player.onGround) {
        player.velocityY = JUMP_FORCE;
        player.onGround = false;
    }

    // Apply gravity
    if (!player.onGround) {
        player.velocityY += GRAVITY
    }

    // Update player position
    player.x += player.velocityX;
    player.y += player.velocityY;

    player.onGround = false;
    // Platform collision
    for (let platform of gameObjects.platforms) {
        if (checkCollision(player, platform)) {
            if (player.velocityY > 0) {
                player.y = platform.y - player.height;
                player.velocityY = 0;
                player.onGround = true;
            }
        }
    }

    // Pipe collision
    for (let pipe of gameObjects.pipes) {
        if (checkCollision(player, pipe)) {
            if (player.velocityY > 0) {
                player.y = pipe.y - player.height;
                player.velocityY = 0;
                player.onGround = true;
            }
        }
    }

    // Enemy movement and collision
    for (let enemy of gameObjects.enemies) {
        if (!enemy.alive) continue;

        enemy.x += enemy.speed * enemy.direction

        let onPlatform = false;
        // Reverse direction at platform edges or boundaries
        for (let platform of gameObjects.platforms) {
            if (enemy.x + enemy.width > platform.x &&
                enemy.x < platform.x + platform.width &&
                enemy.y + enemy.height >= platform.y - 5 &&
                enemy.y + enemy.height <= platform.y + 5
            ) {
                onPlatform = true;
                break;
            }
        }

        if (!onPlatform || enemy.x <= 0 || enemy.x >= 800) {
            enemy.direction *= -1;
        }

        updateElementPosition(enemy.element, enemy.x, enemy.y);

        // Check player-enemy collision
        if (checkCollision(player, enemy)) {
            if (player.velocityY > 0 && player.y < enemy.y) {
                // Jump on enemy
                enemy.alive = false;
                enemy.element.remove();
                player.velocityY = JUMP_FORCE * 0.7;
                gameState.score += 100
            } else {
                // hit by enemy
                if (player.big) {
                    player.big = false;
                    player.bigTimer = 0;
                    player.element.classList.remove('big');
                    player.width = 20;
                    player.height = 20;
                } else if (player.onGround){
                    loseLife();
                }
            }
        }
    }

    // Coin collection
    for (let coin of gameObjects.coins) {
        if (!coin.collected && checkCollision(player, coin)) {
            coin.collected = true;
            coin.element.remove();
            gameState.score += 50;
        }
    }
    
    // Surprise blocks
    for (let block of gameObjects.surpriseBlocks) {
        if (!block.hit && checkCollision(player, block) && player.velocityY < 0) {
            block.hit = true;
            block.element.classList.add('hit');
            spawnItemOnBox(block, block.type)

            if (block.type === 'mushroom') {
                player.big = true;
                player.bigTimer = 600;
                player.element.classList.add('big')
                player.width = 40;
                player.height = 40;
                gameState.score += 100;
            } else if (block.type === 'coin') {
                gameState.score += 50;
            }
        }
    }

    // Pipe interaction to next level
    for (let pipe of gameObjects.pipes) {
        if (player.onGround &&
            player.x + player.width > pipe.x &&
            player.x < pipe.x + pipe.width &&
            Math.abs(player.y + player.height - pipe.y) < 5 &&
            (gameState.keys['ArrowDown'] || gameState.keys['KeyS'])) {
            nextLevel()
        }
    }

    // Fall death
    if (player.y > 400) {
        loseLife();
    }


    updateElementPosition(player.element, player.x, player.y);
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('levels').textContent = gameState.level;
    document.getElementById('lives').textContent = gameState.lives;
    // Add at end of update() function
    let elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('time').textContent = elapsed;
}

function checkCollision(element1, element2) {
    return element1.x < element2.x + element2.width &&
        element1.x + element1.width > element2.x &&
        element1.y < element2.y + element2.height &&
        element1.y + element1.height > element2.y
}

function spawnItemOnBox(block, type) {
    const gameArea = document.getElementById('game-area');
    const item = document.createElement('div');
    item.classList.add(type);
    item.style.left = block.x + 'px';
    item.style.top = (block.y - 20) + 'px'
    gameArea.appendChild(item);

    const itemObj = {
        x: block.x,
        y: block.y - 20,
        width: 20,
        height: 20,
        element: item,
        velocityY: 0,
        frames: 0
    }

    if (type === 'mushroom') {

        function fall() {
            itemObj.velocityY += GRAVITY;
            itemObj.y += itemObj.velocityY;

            let onPlatform = false;
            for (let platform of gameObjects.platforms) {
                if (
                    itemObj.x < platform.x + platform.width &&
                    itemObj.x + itemObj.width > platform.x &&
                    itemObj.y + itemObj.height >= platform.y &&
                    itemObj.y + itemObj.height <= platform.y + 5
                ) {
                    onPlatform = true;
                    itemObj.y = platform.y - itemObj.height;
                    itemObj.velocityY = 0;
                    item.remove();
                    break;
                }
            }

            item.style.top = itemObj.y + 'px';

            if (!onPlatform) {
                requestAnimationFrame(fall)
            }
        }
        fall()

    } else if (type === 'coin') {

        function floatUp() {
            itemObj.y -= 1;
            item.style.top = itemObj.y + 'px';
            itemObj.frames++;

            if (itemObj.frames >= 180) {
                requestAnimationFrame(floatUp)
            } else {
                item.remove();
            }
        }
        floatUp();
    }
}

function loseLife() {
    gameState.lives--;
    if (gameState.lives <= 0) {
        shownGameOver(false)
    } else {
        player.x = 50;
        player.y = 340;
        player.velocityX = 0;
        player.velocityY = 0;
        player.big = false;
        player.bigTimer = 0;
        player.element.classList.remove('big');
        player.width = 20;
        player.height = 20;
    }
}

function nextLevel() {
    gameState.level++;
    if (gameState.level > levels.length) {
        shownGameOver(true);
    } else {
        player.element.classList.remove('big');
        player.width = 20;
        player.height = 20;
        loadLevel(gameState.level - 1);
    }

}


function restartGame() {
    gameStartTime = Date.now();
    gameState = {
        score: 0,
        level: 1,
        lives: 3,
        gameRunning: true,
        keys: {}
    }
    player.big = false;
    player.bigTimer = 0;
    player.element.classList.remove('big');
    player.width = 20;
    player.height = 20;

    document.getElementById('game-over').style.display = 'none';
    initGame()
}
document.getElementById('restart-button').addEventListener('click', restartGame);
// Start Game
initGame();
