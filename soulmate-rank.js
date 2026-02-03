/* ============================================
   SOULMATE RANK SYSTEM + JOKER SHOP
   ============================================
   - 5 levels: Curious → Connected → Close → Intimate → Soulmates
   - Non-linear thresholds; every message from both sides counts
   - Joker modal: all cards visible, locked ones greyed + gated
   ============================================ */

// ──────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────

const RANK_LEVELS = [
    { id: 1, name: 'Curious',   emoji: '🌱' },
    { id: 2, name: 'Connected', emoji: '💫' },
    { id: 3, name: 'Close',     emoji: '🌸' },
    { id: 4, name: 'Intimate',  emoji: '🔥' },
    { id: 5, name: 'Soulmates', emoji: '💕' }
];

// Messages required to REACH each level (cumulative totals).
// Non-linear: gaps widen dramatically at higher levels.
const RANK_THRESHOLDS = [
    0,    // Level 1 starts at 0
    15,   // Level 2 at 15 messages
    50,   // Level 3 at 50
    150,  // Level 4 at 150
    500   // Level 5 at 500
];

// All joker definitions — shown always; locked ones greyed out.
const JOKER_DEFS = [
    {
        id: 'truth',
        title: 'Truth Joker',
        emoji: '🔮',
        desc: 'Pose an honest, deep question — and receive a truthful answer.',
        requiredLevel: 1,
        cost: 2,
        special: false
    },
    {
        id: 'dare',
        title: 'Dare Joker',
        emoji: '⚡',
        desc: 'Challenge each other with a lighthearted dare.',
        requiredLevel: 2,
        cost: 2,
        special: false
    },
    {
        id: 'memory',
        title: 'Memory Joker',
        emoji: '📖',
        desc: 'Share a personal memory that shaped who you are today.',
        requiredLevel: 2,
        cost: 3,
        special: false
    },
    {
        id: 'emotion',
        title: 'Emotion Joker',
        emoji: '💎',
        desc: 'Talk about something that truly moves you — no filters.',
        requiredLevel: 3,
        cost: 3,
        special: false
    },
    {
        id: 'photo_request',
        title: 'Photo Request',
        emoji: '📸',
        desc: 'Send a casual selfie — casual, fun, just for each other.',
        requiredLevel: 3,
        cost: 5,
        special: false
    },
    {
        id: 'intimate_photo',
        title: 'Intimate Photo',
        emoji: '✨',
        desc: 'A rare, special exchange — only for true Soulmates.',
        requiredLevel: 5,
        cost: 10,
        special: true
    }
];

// ──────────────────────────────────────────
// STATE HELPERS (localStorage)
// ──────────────────────────────────────────

function _rankKey()   { return currentUser ? `VIVIANA_${currentUser.userId}_RANK_PROGRESS` : null; }
function _usedKey()   { return currentUser ? `VIVIANA_${currentUser.userId}_JOKER_USED`   : null; }

function getRankProgress() {
    const key = _rankKey();
    if (!key) return 0;
    return parseInt(localStorage.getItem(key) || '0');
}

function setRankProgress(val) {
    const key = _rankKey();
    if (key) localStorage.setItem(key, String(val));
}

function getJokerUsed() {
    const key = _usedKey();
    if (!key) return {};
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { return {}; }
}

function setJokerUsed(obj) {
    const key = _usedKey();
    if (key) localStorage.setItem(key, JSON.stringify(obj));
}

// ──────────────────────────────────────────
// RANK CALCULATION
// ──────────────────────────────────────────

function calcLevel(progress) {
    for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
        if (progress >= RANK_THRESHOLDS[i]) return i + 1; // 1-based
    }
    return 1;
}

// Returns { level, levelObj, progressInLevel, thresholdForLevel, percentToNext }
function getRankInfo() {
    const progress  = getRankProgress();
    const level     = calcLevel(progress);
    const levelObj  = RANK_LEVELS[level - 1];
    const atMax     = level >= RANK_LEVELS.length;

    if (atMax) {
        return { level, levelObj, progressInLevel: 0, thresholdForLevel: 0, percentToNext: 100 };
    }

    const floorThreshold = RANK_THRESHOLDS[level - 1];     // msgs at start of current level
    const ceilThreshold  = RANK_THRESHOLDS[level];         // msgs needed for next level
    const progressInLevel = progress - floorThreshold;
    const thresholdForLevel = ceilThreshold - floorThreshold;
    const percentToNext = Math.round((progressInLevel / thresholdForLevel) * 100);

    return { level, levelObj, progressInLevel, thresholdForLevel, percentToNext };
}

// ──────────────────────────────────────────
// UI: PROGRESS BAR
// ──────────────────────────────────────────

function updateRankUI(animatePulse) {
    const info = getRankInfo();
    const fill = document.getElementById('rankProgressFill');
    const label = document.getElementById('rankLevelLabel');
    const nextLabel = document.getElementById('rankNextLabel');

    if (!fill || !label || !nextLabel) return;

    label.textContent = `${info.levelObj.emoji} ${info.levelObj.name}`;
    fill.style.width = info.percentToNext + '%';

    if (info.level >= RANK_LEVELS.length) {
        nextLabel.textContent = '— max';
    } else {
        nextLabel.textContent = RANK_LEVELS[info.level].name;
    }

    if (animatePulse) {
        fill.classList.remove('level-up-pulse');
        void fill.offsetWidth; // force reflow
        fill.classList.add('level-up-pulse');
    }
}

// ──────────────────────────────────────────
// PROGRESS INCREMENT (called after each message)
// ──────────────────────────────────────────

function incrementRankProgress() {
    if (!currentUser) return;

    const before = getRankProgress();
    const levelBefore = calcLevel(before);

    setRankProgress(before + 1);

    const after = getRankProgress();
    const levelAfter = calcLevel(after);

    const leveledUp = levelAfter > levelBefore;
    updateRankUI(leveledUp);

    if (leveledUp) {
        showRankLevelUpToast(RANK_LEVELS[levelAfter - 1]);
    }
}

// ──────────────────────────────────────────
// TOAST: LEVEL UP NOTIFICATION
// ──────────────────────────────────────────

function showRankLevelUpToast(levelObj) {
    let toast = document.getElementById('rankLevelUpToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'rankLevelUpToast';
        toast.className = 'rank-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = `You reached ${levelObj.emoji} ${levelObj.name}!`;
    toast.classList.add('visible');

    setTimeout(() => toast.classList.remove('visible'), 3200);
}

// ──────────────────────────────────────────
// JOKER MODAL: OPEN / CLOSE
// ──────────────────────────────────────────

function openJokerModal() {
    renderJokerCards();
    const modal = document.getElementById('jokerModal');
    if (modal) modal.classList.add('active');
}

function closeJokerModal() {
    const modal = document.getElementById('jokerModal');
    if (modal) modal.classList.remove('active');
}

// Close on backdrop tap
document.addEventListener('click', function(e) {
    const modal = document.getElementById('jokerModal');
    if (modal && modal.classList.contains('active') && e.target === modal) {
        closeJokerModal();
    }
});

// ──────────────────────────────────────────
// JOKER MODAL: RENDER CARDS
// ──────────────────────────────────────────

function renderJokerCards() {
    const container = document.getElementById('jokerCardsGrid');
    if (!container) return;

    const info = getRankInfo();
    const used = getJokerUsed();
    const balance = currentUser ? getCreditsBalance(currentUser.userId) : 0;

    container.innerHTML = '';

    JOKER_DEFS.forEach(joker => {
        const isUnlocked = info.level >= joker.requiredLevel;
        const wasUsed    = !!used[joker.id];
        const canAfford  = balance >= joker.cost;
        const canUse     = isUnlocked && !wasUsed && canAfford;

        // Determine card class
        let cardClass = 'joker-card';
        if (joker.special && !isUnlocked) {
            cardClass += ' special-locked';
        } else if (!isUnlocked) {
            cardClass += ' locked';
        } else {
            cardClass += ' available';
        }

        const rankName = RANK_LEVELS[joker.requiredLevel - 1].name;

        // Footer content
        let footerHtml;
        if (!isUnlocked) {
            footerHtml = `
                <span class="joker-lock-info">
                    <span class="lock-icon">🔒</span>
                    Reach <strong>${rankName}</strong> to unlock
                </span>
                <span class="joker-price"><span class="credit-icon">💎</span>${joker.cost}</span>
            `;
        } else if (wasUsed) {
            footerHtml = `
                <span class="joker-price"><span class="credit-icon">💎</span>${joker.cost}</span>
                <button class="joker-use-btn" disabled>Used</button>
            `;
        } else {
            footerHtml = `
                <span class="joker-price"><span class="credit-icon">💎</span>${joker.cost}</span>
                <button class="joker-use-btn ${canAfford ? '' : ''}"
                        onclick="useJoker('${joker.id}')"
                        ${canAfford ? '' : 'disabled'}>
                    ${canAfford ? 'Use' : 'Not enough credits'}
                </button>
            `;
        }

        // Special badge
        const specialBadge = joker.special
            ? `<span class="joker-special-badge">✦ Rare</span>`
            : '';

        container.insertAdjacentHTML('beforeend', `
            <div class="${cardClass}">
                <div class="joker-card-header">
                    <div class="joker-card-icon">${joker.emoji}</div>
                    <div class="joker-card-title-wrap">
                        <p class="joker-card-title">${joker.title}${specialBadge}</p>
                    </div>
                    <span class="joker-rank-badge">${rankName}</span>
                </div>
                <p class="joker-card-desc">${joker.desc}</p>
                <div class="joker-card-footer">${footerHtml}</div>
            </div>
        `);
    });
}

// ──────────────────────────────────────────
// JOKER: USE (spend credits + mark used)
// ──────────────────────────────────────────

function useJoker(jokerId) {
    if (!currentUser) return;

    const joker = JOKER_DEFS.find(j => j.id === jokerId);
    if (!joker) return;

    const info = getRankInfo();
    if (info.level < joker.requiredLevel) return;

    const used = getJokerUsed();
    if (used[jokerId]) return;

    // Spend credits
    const result = creditsSpend(currentUser.userId, joker.cost, `Used Joker: ${joker.title}`, { joker_id: jokerId });
    if (!result.success) {
        if (typeof showToast === 'function') showToast('Not enough credits', 'error');
        return;
    }

    // Mark used (persists for this session — resets on page reload for replayability)
    used[jokerId] = true;
    setJokerUsed(used);

    // Update credits display everywhere
    if (typeof updateCreditsDisplay === 'function') updateCreditsDisplay();

    // Inject joker prompt into chat as a system-style message
    injectJokerMessage(joker);

    // Re-render modal to reflect new state
    renderJokerCards();

    // Close modal
    closeJokerModal();
}

// Inject a styled joker activation message into the chat
function injectJokerMessage(joker) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'message joker-message';
    div.innerHTML = `
        <div class="message-bubble joker-bubble">
            <div class="joker-msg-header">
                <span class="joker-msg-icon">${joker.emoji}</span>
                <span class="joker-msg-title">${joker.title} activated</span>
            </div>
            <p class="joker-msg-text">${joker.desc}</p>
            <span class="message-time joker-msg-time">Joker · now</span>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ──────────────────────────────────────────
// HOOK: wrap sendMessage + addReceivedMessage
// ──────────────────────────────────────────

(function hookMessageFunctions() {
    // sendMessage
    const _origSend = window.sendMessage;
    if (_origSend) {
        window.sendMessage = function() {
            _origSend.apply(this, arguments);
            // Only increment if message was actually sent (input was cleared)
            const input = document.getElementById('messageInput');
            if (input && input.value === '') {
                incrementRankProgress();
            }
        };
    }

    // addReceivedMessage
    const _origRecv = window.addReceivedMessage;
    if (_origRecv) {
        window.addReceivedMessage = function() {
            _origRecv.apply(this, arguments);
            incrementRankProgress();
        };
    }
})();

// ──────────────────────────────────────────
// INIT (on DOMContentLoaded or immediately if ready)
// ──────────────────────────────────────────

function initRankSystem() {
    updateRankUI(false);

    // Expose globals
    window.openJokerModal  = openJokerModal;
    window.closeJokerModal = closeJokerModal;
    window.useJoker        = useJoker;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRankSystem);
} else {
    initRankSystem();
}
