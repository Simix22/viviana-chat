/* ============================================
   PROFILE LIST MANAGER
   Manages profile list rendering and state
   ============================================ */

// ========================================
// PROFILE LIST STATE
// ========================================

/**
 * Get profile status for a specific user
 * @param {string} profileId - Profile identifier
 * @returns {object} Status object {status, statusText, badgeClass}
 */
function getProfileStatus(profileId) {
    if (!currentUser) {
        return {
            status: 'locked',
            statusText: 'Tap to start quiz',
            badgeClass: 'offline'
        };
    }

    // Check if quiz is in progress
    const progress = loadProfileQuizProgress(profileId);

    if (!progress) {
        // No progress yet - locked
        return {
            status: 'locked',
            statusText: 'Tap to start quiz',
            badgeClass: 'offline'
        };
    }

    if (progress.isUnlocked) {
        // Quiz completed - unlocked
        return {
            status: 'unlocked',
            statusText: 'Chat unlocked',
            badgeClass: 'online',
            statusClass: 'unlocked'
        };
    }

    // Quiz in progress
    const profile = PROFILES[profileId];
    const totalQuestions = profile ? profile.quizQuestions.length : 6;
    const currentQuestion = progress.currentQuestion + 1;

    return {
        status: 'quiz-open',
        statusText: `Quiz: ${currentQuestion}/${totalQuestions}`,
        badgeClass: 'quiz-open',
        statusClass: 'quiz-open'
    };
}

// ========================================
// RENDER PROFILE LIST
// ========================================

/**
 * Render the contact list (Fanfix-Style)
 */
function renderProfileList() {
    const container = document.querySelector('#profileSelection .profile-selection-container');
    if (!container) {
        console.error('❌ Profile selection container not found');
        return;
    }

    // Build HTML - Clean Dark Messages List
    let html = `
        <!-- Messages Header - Clean -->
        <div class="messages-header">
            <h1>Chats</h1>
        </div>

        <!-- Contact List -->
        <div class="contact-list">
    `;

    // Render each profile as a contact card
    for (const [profileId, profile] of Object.entries(PROFILES)) {
        const status = getProfileStatus(profileId);

        // Get last message preview
        let lastMessage, timeDisplay;
        if (status.status === 'unlocked') {
            // Load actual last message if available
            const msgs = currentUser ? JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]') : [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            lastMessage = lastMsg ? lastMsg.text.substring(0, 40) + (lastMsg.text.length > 40 ? '...' : '') : 'Hey! 👋 So happy you\'re here...';
            timeDisplay = lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'Now';
        } else if (status.status === 'quiz-open') {
            lastMessage = '🎮 ' + status.statusText;
            timeDisplay = '';
        } else {
            lastMessage = '🔒 Tap to start quiz';
            timeDisplay = '';
        }

        // Online indicator for unlocked profiles
        const onlineIndicator = status.status === 'unlocked'
            ? '<div class="contact-online-dot"></div>'
            : '';

        html += `
            <div class="contact-item" onclick="handleProfileClick('${profileId}')" role="button" tabindex="0">
                <div class="contact-avatar">
                    <div class="contact-avatar-img" style="background: ${profile.color};">
                        ${profile.avatar}
                    </div>
                    ${onlineIndicator}
                </div>
                <div class="contact-info">
                    <div class="contact-name">
                        <h3>${profile.name}</h3>
                        ${status.status === 'unlocked' ? '<span class="contact-verified">✓</span>' : ''}
                    </div>
                    <p class="contact-preview">${lastMessage}</p>
                </div>
                <div class="contact-meta">
                    <span class="contact-time">${timeDisplay}</span>
                </div>
            </div>
        `;
    }

    html += `
        </div>
    `;

    container.innerHTML = html;
    console.log('✅ Messages list rendered (Fanfix-style)');
}

/**
 * Handle profile click (start quiz or open chat)
 * @param {string} profileId - Profile identifier
 */
function handleProfileClick(profileId) {
    const profile = PROFILES[profileId];
    if (!profile) {
        console.error(`❌ Profile not found: ${profileId}`);
        return;
    }

    const status = getProfileStatus(profileId);

    console.log(`🎯 Profile clicked: ${profile.name} (status: ${status.status})`);

    if (status.status === 'unlocked') {
        // Quiz completed - go directly to chat (bypass unlock check)
        console.log('✅ Quiz completed, opening chat');
        const states = ['profileSelection', 'quizFlow', 'unlockModal'];
        states.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = 'none';
        });
        const actualChat = document.getElementById('actualChat');
        if (actualChat) actualChat.style.display = 'flex';
        // Hide nav bar when in chat
        const nav = document.querySelector('#chatScreen > .app-nav');
        if (nav) nav.style.display = 'none';
        console.log('📍 Chat opened for: ' + profile.name);
    } else {
        // Locked or quiz in progress - open quiz
        console.log('🎮 Opening quiz');
        openProfileQuiz(profileId);
    }
}

// Make function globally available
window.handleProfileClick = handleProfileClick;

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize profile list on page load
 */
function initProfileList() {
    // Wait for DOM and dependencies to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Wait a bit for other scripts to load
            setTimeout(renderProfileList, 100);
        });
    } else {
        // DOM already loaded
        setTimeout(renderProfileList, 100);
    }

    // Re-render when user logs in or quiz state changes
    if (typeof window.addEventListener !== 'undefined') {
        window.addEventListener('userLoggedIn', renderProfileList);
        window.addEventListener('quizStateChanged', renderProfileList);
    }
}

// Auto-initialize
initProfileList();

// ========================================
// UPDATE PROFILE LIST ON STATE CHANGE
// ========================================

/**
 * Trigger profile list update
 * Call this whenever quiz state changes
 */
function updateProfileListUI() {
    renderProfileList();
}

// Make function globally available
window.updateProfileListUI = updateProfileListUI;

// Override quiz completion to trigger list update
const _originalClearProfileQuizProgress = window.clearProfileQuizProgress;
window.clearProfileQuizProgress = function(profileId) {
    if (_originalClearProfileQuizProgress) {
        _originalClearProfileQuizProgress(profileId);
    }

    // Update profile list
    setTimeout(updateProfileListUI, 100);
};

// Override quiz save to trigger list update
const _originalSaveProfileQuizProgress = window.saveProfileQuizProgress;
window.saveProfileQuizProgress = function(profileId, progressData) {
    if (_originalSaveProfileQuizProgress) {
        _originalSaveProfileQuizProgress(profileId, progressData);
    }

    // Update profile list
    setTimeout(updateProfileListUI, 100);
};

// ========================================
// UTILITY: SHOW CHAT STATE
// ========================================

/**
 * Helper to switch between chat states
 * @param {string} state - State to show ('profileSelection', 'actualChat', etc.)
 */
function showChatState(state) {
    const states = ['profileSelection', 'actualChat', 'quizFlow', 'unlockModal'];

    states.forEach(s => {
        const element = document.getElementById(s);
        if (element) {
            element.style.display = (s === state) ? 'flex' : 'none';
        }
    });

    // Hide nav bar when in actual chat, show it otherwise
    const nav = document.querySelector('#chatScreen > .app-nav');
    if (nav) {
        nav.style.display = (state === 'actualChat') ? 'none' : 'flex';
    }

    console.log(`📍 Chat state changed to: ${state}`);
}

// Make function globally available if not already defined
if (typeof window.showChatState === 'undefined') {
    window.showChatState = showChatState;
}

console.log('✅ Profile List Manager initialized');
