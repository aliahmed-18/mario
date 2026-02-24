// ============================================================
//  MARIO JS  –  Complete Game with Story Mode + Scoreboard
// ============================================================

// ── Constants ────────────────────────────────────────────────
const GRAVITY     = 0.5;
const JUMP_FORCE  = -12;
const MOVE_SPEED  = 5;
const ENEMY_SPEED = 1;

// ── API ──────────────────────────────────────────────────────
// Relative URL — works on any host/port since the Go server serves both game + API.
const API_URL = '/scores';

// ── Story Mode Config ─────────────────────────────────────────
const STORY_SCORE_THRESHOLD = 300;

let storyState = {
    introShown:       false,
    developmentShown: false,
    conclusionShown:  false
};

// ── Performance tracking ─────────────────────────────────────
let lastFrameTime = 0;
let frameTimes    = [];
const FPS_SAMPLES = 60;

// ── Timers ───────────────────────────────────────────────────
let gameStartTime = 0;
let pausedAt      = 0;
let totalPausedMs = 0;

// ── Game state ────────────────────────────────────────────────
let gameState = {
    score:       0,
    level:       1,
    lives:       3,
    gameRunning: true,
    gamePaused:  false,
    storyPaused: false,
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
//  SCOREBOARD  –  helpers
// ============================================================

/** Format seconds → "MM:SS" */
function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Rank suffix: 1 → "st", 2 → "nd", etc. */
function rankSuffix(n) {
    if (n === 11 || n === 12 || n === 13) return 'th';
    switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

const ROWS_PER_PAGE = 5;
let sbAllScores  = [];   // full sorted list from API
let sbPage       = 0;    // 0-based current page
let sbMyName     = '';   // name submitted this session (for highlighting)
let sbMyScore    = 0;

/** Post a score to the Go API, returns sorted list or null on error */
async function apiPostScore(name, score, timeStr) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score, time: timeStr })
        });
        if (!res.ok) throw new Error('POST failed');
        return await res.json();
    } catch (e) {
        console.warn('Score API unavailable – showing local only:', e);
        return null;
    }
}

/** GET all scores from the Go API, returns sorted list or null on error */
async function apiGetScores() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('GET failed');
        return await res.json();
    } catch (e) {
        console.warn('Score API unavailable:', e);
        return null;
    }
}

// ── Scoreboard pagination ────────────────────────────────────

function sbRender() {
    const tbody      = document.getElementById('sb-tbody');
    const pageInfo   = document.getElementById('sb-page-info');
    const btnPrev    = document.getElementById('sb-prev');
    const btnNext    = document.getElementById('sb-next');
    const totalPages = Math.max(1, Math.ceil(sbAllScores.length / ROWS_PER_PAGE));

    pageInfo.textContent = `Page ${sbPage + 1} / ${totalPages}`;
    btnPrev.disabled = sbPage === 0;
    btnNext.disabled = sbPage >= totalPages - 1;

    tbody.innerHTML = '';

    if (sbAllScores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="sb-empty">No scores yet — be the first!</td></tr>`;
        return;
    }

    const start = sbPage * ROWS_PER_PAGE;
    const slice = sbAllScores.slice(start, start + ROWS_PER_PAGE);

    slice.forEach((entry, idx) => {
        const rank      = start + idx + 1;
        const isMe      = entry.name === sbMyName && entry.score === sbMyScore;
        const tr        = document.createElement('tr');
        if (isMe) tr.classList.add('sb-my-row');

        // Rank cell
        const sfx       = rankSuffix(rank);
        let rankHTML;
        if (rank === 1) rankHTML = `<span class="sb-rank-1">🥇</span>`;
        else if (rank === 2) rankHTML = `<span class="sb-rank-2">🥈</span>`;
        else if (rank === 3) rankHTML = `<span class="sb-rank-3">🥉</span>`;
        else rankHTML = `${rank}<sup class="sb-rank-suffix">${sfx}</sup>`;

        tr.innerHTML = `
            <td>${rankHTML}</td>
            <td>${escapeHTML(entry.name || '-.-')}</td>
            <td>${entry.score.toLocaleString()}</td>
            <td>${escapeHTML(entry.time || '--:--')}</td>
        `;
        tbody.appendChild(tr);
    });
}

function sbShowPercentile(myRank, total) {
    const banner = document.getElementById('sb-percentile-banner');
    if (!sbMyName || total === 0) { banner.classList.remove('show'); return; }

    const pct = Math.round((1 - (myRank - 1) / total) * 100);
    const sfx = rankSuffix(myRank);
    banner.textContent =
        `🎉 Congrats ${sbMyName}, you are in the top ${pct}%, on the ${myRank}${sfx} position!`;
    banner.classList.add('show');
}

function sbJumpToMyPage() {
    if (!sbMyName) return;
    const idx = sbAllScores.findIndex(e => e.name === sbMyName && e.score === sbMyScore);
    if (idx !== -1) {
        sbPage = Math.floor(idx / ROWS_PER_PAGE);
    }
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Show scoreboard overlay ──────────────────────────────────

function showScoreboard(scores) {
    sbAllScores = scores || [];

    // Find player's rank for percentile
    let myRank = -1;
    if (sbMyName) {
        myRank = sbAllScores.findIndex(e => e.name === sbMyName && e.score === sbMyScore) + 1;
    }
    sbShowPercentile(myRank > 0 ? myRank : 0, sbAllScores.length);
    sbJumpToMyPage();
    sbRender();

    document.getElementById('scoreboard-overlay').classList.add('visible');
}

function hideScoreboard() {
    document.getElementById('scoreboard-overlay').classList.remove('visible');
}

// Pagination buttons
document.getElementById('sb-prev').addEventListener('click', () => {
    if (sbPage > 0) { sbPage--; sbRender(); }
});
document.getElementById('sb-next').addEventListener('click', () => {
    const totalPages = Math.ceil(sbAllScores.length / ROWS_PER_PAGE);
    if (sbPage < totalPages - 1) { sbPage++; sbRender(); }
});

// Play again from scoreboard
document.getElementById('sb-play-again').addEventListener('click', () => {
    hideScoreboard();
    restartGame();
});

// ============================================================
//  NAME PROMPT
// ============================================================

function showNamePrompt(won, score, elapsedSeconds, onDone) {
    const overlay   = document.getElementById('name-overlay');
    const icon      = document.getElementById('name-result-icon');
    const title     = document.getElementById('name-result-title');
    const scoreSpan = document.getElementById('name-final-score');
    const input     = document.getElementById('player-name-input');

    icon.textContent  = won ? '🎉' : '💀';
    title.textContent = won ? 'You Won!' : 'Game Over';
    scoreSpan.textContent = score.toLocaleString();
    input.value = '';

    overlay.classList.add('visible');
    setTimeout(() => input.focus(), 350);

    const timeStr = formatTime(elapsedSeconds);

    async function submit() {
        const name = input.value.trim().slice(0, 12) || 'Anon';
        overlay.classList.remove('visible');
        sbMyName  = name;
        sbMyScore = score;
        sbPage    = 0;

        const scores = await apiPostScore(name, score, timeStr);
        onDone(scores || [{ name, score, time: timeStr }]);
    }

    async function skip() {
        overlay.classList.remove('visible');
        sbMyName  = '';
        sbMyScore = 0;
        sbPage    = 0;
        const scores = await apiGetScores();
        onDone(scores || []);
    }

    // Wire up fresh listeners each time
    const submitBtn = document.getElementById('name-submit-btn');
    const skipBtn   = document.getElementById('name-skip-btn');

    const freshSubmit = submitBtn.cloneNode(true);
    const freshSkip   = skipBtn.cloneNode(true);
    submitBtn.replaceWith(freshSubmit);
    skipBtn.replaceWith(freshSkip);

    document.getElementById('name-submit-btn').addEventListener('click', submit);
    document.getElementById('name-skip-btn').addEventListener('click', skip);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });
}

// ============================================================
//  STORY DATA
// ============================================================
const story = {
    intro: {
        title: "Chapter I — The Darkness Descends",
        icon: "🌑",
        paragraphs: [
            "The Mushroom Kingdom once glowed with warmth and laughter. Children danced in meadows, coins clinked in the market square, and the great princess Rosalina watched over all from her star-lit tower.",
            "But one moonless night, the Eternal Shadow — a wicked sorcerer banished long ago — crept back through the cracks between worlds. With a wave of his obsidian staff he shattered the Kingdom's Crystal Heart into ten fragments, scattering them across ten treacherous lands.",
            "Without the Crystal Heart, darkness spreads a little more each hour. Crops wither. Skies turn grey. And the princess… has gone silent.",
            "You are Mario, a humble plumber with an extraordinary heart. The elder of the village hands you a worn leather satchel. <em>\"Ten lands, ten fragments,\"</em> he whispers. <em>\"Only you can put the world back together.\"</em>",
            "Your journey begins now. <strong>The Kingdom is counting on you.</strong>"
        ],
        buttonLabel: "Begin the Journey ▶"
    },

    development: {
        title: "Chapter II — A Glimmer of Hope",
        icon: "✨",
        paragraphs: [
            "You wipe the sweat from your brow. The first fragment glows faintly in your satchel — warm, like a small sun pressed against your ribs.",
            "But a messenger crow swoops down, dropping a crumpled note. It reads:",
            "<blockquote>\"Mario — the Shadow has learned of your quest. His generals march faster now. The eastern bridges are falling. If you do not reach the Storm Citadel before the last light fades, all is lost.\" — R</blockquote>",
            "R. Only one person signs their name with a single letter. Princess Rosalina is alive.",
            "A surge of hope floods your chest. You are not just collecting shards — you are racing against an army. Every coin gathered fuels the Kingdom's resistance. Every enemy stomped pushes back the tide of darkness.",
            "<strong>Run faster, Mario. She's waiting.</strong>"
        ],
        buttonLabel: "Press On ▶"
    },

    victoryConclusion: {
        title: "Epilogue — The Heart Restored",
        icon: "💎",
        paragraphs: [
            "The last fragment slots into place with a sound like a thousand bells ringing at once.",
            "A pillar of golden light erupts from the Crystal Heart, tearing through storm clouds that have choked the sky for weeks. Across the Kingdom, flowers open. Lanterns relight themselves. Children run out of their homes and stare upward, mouths open.",
            "From the tower, a figure emerges — Rosalina, her silver gown trailing starlight. She descends the staircase and stops before you. Her eyes are tired, but they shine.",
            "<em>\"I watched every step,\"</em> she says softly. <em>\"I called to the stars, and they led you here.\"</em>",
            "The Eternal Shadow dissolves into nothing — not with a roar, but a sigh, as if it had always known this moment would come.",
            "The elder was right. It was never about one hero. It was about a Kingdom worth fighting for.",
            "<strong>🎉 The Crystal Heart is whole. The Mushroom Kingdom is saved. Well done, Mario.</strong>"
        ],
        buttonLabel: "Return Home 🏠"
    },

    defeatConclusion: {
        title: "Epilogue — The Long Night",
        icon: "🌑",
        paragraphs: [
            "The darkness closes in. The last fragment slips from your fingers and shatters on cold stone.",
            "Across the Kingdom, lanterns gutter out one by one. The Crystal Heart, broken beyond mending, goes cold.",
            "Yet even in defeat, your courage was not nothing. The villagers speak of a plumber who ran headlong into shadow without hesitation. They will remember. They will rebuild — slowly, painfully, in the dark.",
            "<em>\"Every hero who tried made the next one a little stronger,\"</em> the elder says, placing a hand on your shoulder.",
            "The Eternal Shadow laughs — but it is a hollow laugh. Because stories don't end with one chapter.",
            "<strong>💪 The Kingdom endures. Try again, Mario — the Heart is waiting.</strong>"
        ],
        buttonLabel: "Check the Scoreboard ▶"
    }
};

// ============================================================
//  STORY OVERLAY – show / hide
// ============================================================
function showStoryCard(beat, onContinue) {
    gameState.storyPaused = true;

    const overlay = document.getElementById('story-overlay');
    const icon    = document.getElementById('story-icon');
    const title   = document.getElementById('story-title');
    const body    = document.getElementById('story-body');
    const btn     = document.getElementById('story-btn');

    icon.textContent  = beat.icon;
    title.textContent = beat.title;

    body.innerHTML = beat.paragraphs.map(p => `<p>${p}</p>`).join('');
    btn.textContent = beat.buttonLabel;

    const freshBtn = btn.cloneNode(true);
    btn.replaceWith(freshBtn);

    document.getElementById('story-btn').addEventListener('click', () => {
        hideStoryCard();
        onContinue();
    });

    overlay.classList.add('visible');

    const paragraphs = body.querySelectorAll('p');
    paragraphs.forEach((p, i) => {
        p.style.opacity    = '0';
        p.style.transform  = 'translateY(16px)';
        p.style.transition = `opacity 0.5s ${0.15 + i * 0.18}s, transform 0.5s ${0.15 + i * 0.18}s`;
        requestAnimationFrame(() => {
            p.style.opacity   = '1';
            p.style.transform = 'translateY(0)';
        });
    });
}

function hideStoryCard() {
    document.getElementById('story-overlay').classList.remove('visible');
    gameState.storyPaused = false;
}

// ============================================================
//  LEVELS
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
            { x: 490, y: 340, type: 'red' },  { x: 640, y: 340, type: 'red' }
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
            { x: 170, y: 304, type: 'red' },    { x: 290, y: 264, type: 'purple' },
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
            { x: 210, y: 164, type: 'red'  },   { x: 310, y: 164, type: 'red'  },
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
            { x: 305, y: 294, type: 'red'  },   { x: 425, y: 294, type: 'purple' },
            { x: 545, y: 294, type: 'brown'  }, { x: 125, y: 234, type: 'orange' },
            { x: 365, y: 234, type: 'red'  },   { x: 605, y: 234, type: 'purple' }
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
            { x: 210, y: 324, type: 'orange' }, { x: 330, y: 294, type: 'red'    },
            { x: 450, y: 264, type: 'orange' }, { x: 570, y: 234, type: 'purple' },
            { x: 670, y: 344, type: 'orange' }, { x: 710, y: 344, type: 'brown'  },
            { x: 150, y: 224, type: 'red'    }, { x: 290, y: 194, type: 'brown'  },
            { x: 430, y: 164, type: 'purple' }, { x: 570, y: 134, type: 'purple' },
            { x: 690, y: 184, type: 'red'    }
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

function startWithIntro() {
    if (!storyState.introShown) {
        storyState.introShown = true;
        showStoryCard(story.intro, () => {
            gameStartTime = performance.now();
            lastFrameTime = performance.now();
            totalPausedMs = 0;
            requestAnimationFrame(gameLoop);
        });
    }
}

// ============================================================
//  LOAD LEVEL
// ============================================================
function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) { showGameOver(true); return; }

    clearLevel();

    const level    = levels[levelIndex];
    const gameArea = document.getElementById('game-area');

    player.x = 50; player.y = 340;
    player.velocityX = 0; player.velocityY = 0;
    player.onGround = false;
    player.big = false; player.bigTimer = 0;
    player.element.className = '';
    setTransform(player.element, player.x, player.y);

    level.platforms.forEach((pd, i) => {
        const el = createElement('div', `platform ${pd.type}`, {
            left: pd.x + 'px', top: pd.y + 'px',
            width: pd.width + 'px', height: pd.height + 'px'
        });
        gameArea.appendChild(el);
        gameObjects.platforms.push({ element: el, ...pd, id: 'platform-' + i });
    });

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

    level.coins.forEach((cd, i) => {
        const el = createElement('div', 'coin', { left: cd.x + 'px', top: cd.y + 'px' });
        gameArea.appendChild(el);
        gameObjects.coins.push({
            element: el, x: cd.x, y: cd.y, width: 20, height: 20,
            collected: false, id: 'coin-' + i
        });
    });

    level.surpriseBlocks.forEach((bd, i) => {
        const el = createElement('div', 'surprise-block', { left: bd.x + 'px', top: bd.y + 'px' });
        gameArea.appendChild(el);
        gameObjects.surpriseBlocks.push({
            element: el, x: bd.x, y: bd.y, width: 20, height: 20,
            type: bd.type, hit: false, id: 'block-' + i
        });
    });

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

// ============================================================
//  GAME OVER  →  story card  →  name prompt  →  scoreboard
// ============================================================
function showGameOver(won) {
    gameState.gameRunning = false;

    // Snapshot elapsed time before anything pauses the clocks
    const elapsedSeconds = Math.floor(
        (performance.now() - gameStartTime - totalPausedMs) / 1000
    );
    const finalScore = gameState.score;

    storyState.conclusionShown = true;
    const conclusionBeat = won ? story.victoryConclusion : story.defeatConclusion;

    showStoryCard(conclusionBeat, () => {
        // After story card → name prompt
        showNamePrompt(won, finalScore, elapsedSeconds, (scores) => {
            // After name entered/skipped → scoreboard
            showScoreboard(scores);
        });
    });
}

// ============================================================
//  PAUSE MENU
// ============================================================
function togglePause() {
    if (!gameState.gameRunning) return;
    if (gameState.storyPaused)  return;

    gameState.gamePaused = !gameState.gamePaused;
    document.getElementById('pause-menu').style.display =
        gameState.gamePaused ? 'flex' : 'none';

    if (gameState.gamePaused) {
        pausedAt = performance.now();
    } else {
        totalPausedMs += performance.now() - pausedAt;
        lastFrameTime = performance.now();
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
//  INPUT
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
//  GAME LOOP
// ============================================================
function gameLoop(timestamp) {
    if (!gameState.gameRunning) return;
    if (gameState.gamePaused)   return;
    if (gameState.storyPaused)  return;

    const delta   = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    frameTimes.push(delta);
    if (frameTimes.length > FPS_SAMPLES) frameTimes.shift();
    const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps      = Math.round(1000 / avgDelta);

    const fpsEl = document.getElementById('fps');
    if (fpsEl) {
        fpsEl.textContent = fps;
        fpsEl.style.color = fps >= 55 ? '#00ff88'
                          : fps >= 30 ? '#ffcc00'
                          :             '#ff4444';
    }

    update();
    requestAnimationFrame(gameLoop);
}

// ============================================================
//  UPDATE
// ============================================================
function update() {

    // ── Mid-game story beat ───────────────────────────────────
    if (!storyState.developmentShown && gameState.score >= STORY_SCORE_THRESHOLD) {
        storyState.developmentShown = true;
        gameState.storyPaused = true;
        setTimeout(() => {
            showStoryCard(story.development, () => {
                lastFrameTime = performance.now();
                requestAnimationFrame(gameLoop);
            });
        }, 200);
        return;
    }

    if (gameState.keys['ArrowLeft'] || gameState.keys['KeyA']) {
        player.velocityX = -MOVE_SPEED;
    } else if (gameState.keys['ArrowRight'] || gameState.keys['KeyD']) {
        player.velocityX = MOVE_SPEED;
    } else {
        player.velocityX *= 0.8;
    }

    if ((gameState.keys['Space'] || gameState.keys['ArrowUp'] || gameState.keys['KeyW'])
            && player.onGround) {
        player.velocityY = JUMP_FORCE;
        player.onGround  = false;
    }

    if (!player.onGround) player.velocityY += GRAVITY;

    player.x += player.velocityX;
    player.y += player.velocityY;
    player.onGround = false;

    for (const platform of gameObjects.platforms) {
        if (checkCollision(player, platform) && player.velocityY > 0) {
            player.y         = platform.y - player.height;
            player.velocityY = 0;
            player.onGround  = true;
        }
    }

    for (const pipe of gameObjects.pipes) {
        if (checkCollision(player, pipe) && player.velocityY > 0) {
            player.y         = pipe.y - player.height;
            player.velocityY = 0;
            player.onGround  = true;
        }
    }

    for (const enemy of gameObjects.enemies) {
        if (!enemy.alive) continue;

        enemy.x += enemy.speed * enemy.direction;

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

        if (checkCollision(player, enemy)) {
            if (player.velocityY > 0 && player.y < enemy.y) {
                enemy.alive = false;
                enemy.element.remove();
                player.velocityY  = JUMP_FORCE * 0.7;
                gameState.score  += 100;
            } else if (player.big) {
                player.big      = false;
                player.bigTimer = 0;
                player.element.classList.remove('big');
                player.width = 20; player.height = 20;
            } else if (player.onGround) {
                loseLife();
            }
        }
    }

    for (const coin of gameObjects.coins) {
        if (!coin.collected && checkCollision(player, coin)) {
            coin.collected = true;
            coin.element.remove();
            gameState.score += 50;
        }
    }

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
            } else if (block.type === 'coin') {
                gameState.score += 50;
            }
        }
    }

    for (const pipe of gameObjects.pipes) {
        if (player.onGround &&
            player.x + player.width > pipe.x &&
            player.x < pipe.x + pipe.width &&
            Math.abs(player.y + player.height - pipe.y) < 5 &&
            (gameState.keys['ArrowDown'] || gameState.keys['KeyS'])) {
            nextLevel();
        }
    }

    if (player.y > 400) loseLife();

    setTransform(player.element, player.x, player.y);

    document.getElementById('score').textContent  = gameState.score;
    document.getElementById('levels').textContent = gameState.level;
    document.getElementById('lives').textContent  = gameState.lives;

    const elapsed = Math.floor(
        (performance.now() - gameStartTime - totalPausedMs) / 1000
    );
    document.getElementById('time').textContent = elapsed;
}

// ============================================================
//  COLLISION
// ============================================================
function checkCollision(a, b) {
    return a.x < b.x + b.width  &&
           a.x + a.width  > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// ============================================================
//  ITEM SPAWN
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

    storyState = { introShown: false, developmentShown: false, conclusionShown: false };

    gameState = {
        score: 0, level: 1, lives: 3,
        gameRunning: true, gamePaused: false, storyPaused: false,
        keys: {}
    };

    player.big = false; player.bigTimer = 0;
    player.element.classList.remove('big');
    player.width = 20; player.height = 20;

    document.getElementById('game-over').style.display   = 'none';
    document.getElementById('pause-menu').style.display  = 'none';
    document.getElementById('story-overlay').classList.remove('visible');
    document.getElementById('name-overlay').classList.remove('visible');
    hideScoreboard();

    sbMyName  = '';
    sbMyScore = 0;
    sbPage    = 0;

    loadLevel(0);
    startWithIntro();
}

document.getElementById('restart-button').addEventListener('click', restartGame);

// ── Boot ─────────────────────────────────────────────────────
loadLevel(0);
startWithIntro();