/* ============================================
   DISCOVER PAGE - Tinder-Style
   Fake profiles, swipe/like, no backend
   ============================================ */

// ========================================
// FAKE PROFILE DATA (Static, no backend)
// ========================================

const DISCOVER_PROFILES = [
    {
        id: 'd1',
        name: 'Lena',
        age: 24,
        tagline: 'Coffee addict & weekend hiker',
        tags: ['Hiking', 'Coffee', 'Music'],
        image: 'https://i.pravatar.cc/600?img=47'
    },
    {
        id: 'd2',
        name: 'Mia',
        age: 22,
        tagline: 'Bookworm & sunset chaser',
        tags: ['Reading', 'Travel', 'Yoga'],
        image: 'https://i.pravatar.cc/600?img=45'
    },
    {
        id: 'd3',
        name: 'Sophie',
        age: 25,
        tagline: 'Gym is my therapy',
        tags: ['Fitness', 'Cooking', 'Movies'],
        image: 'https://i.pravatar.cc/600?img=44'
    },
    {
        id: 'd4',
        name: 'Julia',
        age: 23,
        tagline: 'Dancing through life',
        tags: ['Dance', 'Art', 'Brunch'],
        image: 'https://i.pravatar.cc/600?img=46'
    },
    {
        id: 'd5',
        name: 'Emma',
        age: 26,
        tagline: 'Dog mom & adventure seeker',
        tags: ['Dogs', 'Camping', 'Photography'],
        image: 'https://i.pravatar.cc/600?img=48'
    },
    {
        id: 'd6',
        name: 'Sara',
        age: 21,
        tagline: 'Life is too short for boring',
        tags: ['Parties', 'Fashion', 'Netflix'],
        image: 'https://i.pravatar.cc/600?img=49'
    },
    {
        id: 'd7',
        name: 'Anna',
        age: 24,
        tagline: 'Plant lady & pasta lover',
        tags: ['Plants', 'Pasta', 'Wine'],
        image: 'https://i.pravatar.cc/600?img=50'
    },
    {
        id: 'd8',
        name: 'Nina',
        age: 25,
        tagline: 'Lost in the music',
        tags: ['Music', 'Concerts', 'Vinyl'],
        image: 'https://i.pravatar.cc/600?img=43'
    }
];

// ========================================
// STATE
// ========================================

let discoverQueue = [];      // Shuffled copy of profiles
let currentCardIndex = 0;    // Which card is on top

// ========================================
// INITIALIZE DISCOVER
// ========================================

function initDiscover() {
    // Shuffle profiles for variety
    discoverQueue = [...DISCOVER_PROFILES].sort(() => Math.random() - 0.5);
    currentCardIndex = 0;

    renderCards();
    bindSwipeGesture();
}

// ========================================
// SHOW / HIDE DISCOVER
// ========================================

function showDiscover() {
    if (!currentUser) {
        showAuth();
        return;
    }

    hideAllScreens();
    const screen = document.getElementById('discoverScreen');
    screen.style.display = 'flex';
    screen.classList.add('active');
    updateNavButtons('discover');

    // Init if needed
    if (discoverQueue.length === 0) {
        initDiscover();
    }
}

// Make global
window.showDiscover = showDiscover;

// ========================================
// RENDER CARDS
// ========================================

function renderCards() {
    const stack = document.getElementById('discoverCardStack');
    if (!stack) return;

    stack.innerHTML = '';

    // Render up to 3 cards (top + 2 behind for depth)
    for (let i = 2; i >= 0; i--) {
        const idx = currentCardIndex + i;
        if (idx >= discoverQueue.length) continue;

        const profile = discoverQueue[idx];
        const card = createCard(profile);

        if (i === 0) {
            card.classList.add('card-top');
        } else if (i === 1) {
            card.classList.add('card-behind-1');
        } else if (i === 2) {
            card.classList.add('card-behind-2');
        }

        stack.appendChild(card);
    }

    // Show/hide empty state
    const emptyState = document.getElementById('discoverEmpty');
    if (currentCardIndex >= discoverQueue.length) {
        if (emptyState) emptyState.classList.add('visible');
    } else {
        if (emptyState) emptyState.classList.remove('visible');
    }
}

function createCard(profile) {
    const card = document.createElement('div');
    card.className = 'discover-card';
    card.dataset.profileId = profile.id;

    card.innerHTML = `
        <div class="card-like-label">LIKE</div>
        <div class="card-nope-label">NOPE</div>
        <div class="discover-card-image" style="background-image: url('${profile.image}')">
            <div class="discover-card-info">
                <div class="discover-card-name">${profile.name}</div>
                <div class="discover-card-age">${profile.age}</div>
            </div>
        </div>
        <div class="discover-card-details">
            <p class="discover-card-tagline">${profile.tagline}</p>
            <div class="discover-card-tags">
                ${profile.tags.map(tag => `<span class="discover-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `;

    return card;
}

// ========================================
// SWIPE GESTURE (Touch + Mouse)
// ========================================

let startX = 0;
let startY = 0;
let isDragging = false;
let currentCard = null;

function bindSwipeGesture() {
    const stack = document.getElementById('discoverCardStack');
    if (!stack) return;

    // Touch events
    stack.addEventListener('touchstart', onDragStart, { passive: true });
    stack.addEventListener('touchmove', onDragMove, { passive: false });
    stack.addEventListener('touchend', onDragEnd);

    // Mouse events
    stack.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
}

function onDragStart(e) {
    const topCard = document.querySelector('.discover-card.card-top');
    if (!topCard) return;

    currentCard = topCard;
    isDragging = true;

    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;

    // Disable transition while dragging
    currentCard.style.transition = 'none';
}

function onDragMove(e) {
    if (!isDragging || !currentCard) return;

    e.preventDefault();

    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Rotate based on horizontal movement
    const rotation = dx * 0.08; // Subtle rotation

    currentCard.style.transform = `translateX(${dx}px) translateY(${dy}px) rotate(${rotation}deg)`;

    // Show LIKE / NOPE labels based on direction
    const likeLabel = currentCard.querySelector('.card-like-label');
    const nopeLabel = currentCard.querySelector('.card-nope-label');

    if (dx > 40) {
        likeLabel.style.opacity = Math.min((dx - 40) / 80, 1);
        nopeLabel.style.opacity = 0;
    } else if (dx < -40) {
        nopeLabel.style.opacity = Math.min((-dx - 40) / 80, 1);
        likeLabel.style.opacity = 0;
    } else {
        likeLabel.style.opacity = 0;
        nopeLabel.style.opacity = 0;
    }
}

function onDragEnd(e) {
    if (!isDragging || !currentCard) return;
    isDragging = false;

    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const dx = touch.clientX - startX;

    // Re-enable transition
    currentCard.style.transition = '';

    // Threshold: if dragged far enough, swipe away
    if (dx > 100) {
        swipeCard('right'); // Like
    } else if (dx < -100) {
        swipeCard('left');  // Skip
    } else {
        // Snap back
        currentCard.style.transform = '';
        const likeLabel = currentCard.querySelector('.card-like-label');
        const nopeLabel = currentCard.querySelector('.card-nope-label');
        if (likeLabel) likeLabel.style.opacity = 0;
        if (nopeLabel) nopeLabel.style.opacity = 0;
    }

    currentCard = null;
}

// ========================================
// SWIPE CARD (programmatic)
// ========================================

function swipeCard(direction) {
    const topCard = document.querySelector('.discover-card.card-top');
    if (!topCard) return;

    // Add swipe class
    topCard.classList.add(direction === 'right' ? 'swipe-right' : 'swipe-left');

    // If like (right), show heart burst
    if (direction === 'right') {
        showHeartBurst();
    }

    // After animation, advance to next card
    setTimeout(() => {
        currentCardIndex++;
        renderCards();
    }, 400);
}

// ========================================
// BUTTON ACTIONS
// ========================================

function discoverLike() {
    swipeCard('right');
}

function discoverSkip() {
    swipeCard('left');
}

function discoverRefresh() {
    // Re-shuffle and restart
    discoverQueue = [...DISCOVER_PROFILES].sort(() => Math.random() - 0.5);
    currentCardIndex = 0;
    renderCards();
}

// Make global
window.discoverLike = discoverLike;
window.discoverSkip = discoverSkip;
window.discoverRefresh = discoverRefresh;

// ========================================
// HEART BURST ANIMATION
// ========================================

function showHeartBurst() {
    const burst = document.createElement('div');
    burst.className = 'heart-burst';
    burst.textContent = '❤️';
    document.body.appendChild(burst);

    // Remove after animation
    setTimeout(() => burst.remove(), 600);
}

// ========================================
// AUTO-INIT
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiscover);
} else {
    initDiscover();
}

console.log('✅ Discover initialized');
