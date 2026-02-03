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
 * Render the profile list in profile selection screen
 */
function renderProfileList() {
    const container = document.querySelector('#profileSelection .profile-selection-container');
    if (!container) {
        console.error('❌ Profile selection container not found');
        return;
    }

    // Build HTML
    let html = `
        <div class="profile-list-header">
            <h2>Your Chats</h2>
            <p class="profile-list-subtitle">Choose a profile to start or continue chatting</p>
        </div>
        <div class="profile-list">
    `;

    // Render each profile
    for (const [profileId, profile] of Object.entries(PROFILES)) {
        const status = getProfileStatus(profileId);

        html += `
            <div class="profile-list-item" onclick="handleProfileClick('${profileId}')" role="button" tabindex="0"
                 onkeypress="if(event.key==='Enter') handleProfileClick('${profileId}')">
                <div class="profile-list-avatar">
                    <div class="profile-list-avatar-circle" style="background: ${profile.color};">
                        ${profile.avatar}
                    </div>
                    <div class="profile-list-status-badge ${status.badgeClass}"></div>
                </div>
                <div class="profile-list-info">
                    <h3 class="profile-list-name">
                        ${profile.name}
                        ${status.status === 'unlocked' ? '<span class="profile-list-verified">✓</span>' : ''}
                    </h3>
                    <p class="profile-list-tagline">${profile.tagline}</p>
                    <p class="profile-list-status ${status.statusClass || ''}">
                        ${status.statusText}
                    </p>
                </div>
                <div class="profile-list-action">
                    <div class="profile-list-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }

    html += `
        </div>
    `;

    container.innerHTML = html;
    console.log('✅ Profile list rendered');
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
        // Quiz completed - go to chat
        console.log('✅ Quiz completed, opening chat');
        showChatState('actualChat');
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
            if (s === state) {
                element.style.display = (s === 'profileSelection') ? 'flex' : 'flex';
            } else {
                element.style.display = 'none';
            }
        }
    });

    console.log(`📍 Chat state changed to: ${state}`);
}

// Make function globally available if not already defined
if (typeof window.showChatState === 'undefined') {
    window.showChatState = showChatState;
}

console.log('✅ Profile List Manager initialized');
