/* ============================================
   PROFILE QUIZ SYSTEM
   Multi-profile support with quiz tracking
   ============================================ */

// ========================================
// PROFILE DATA MODEL
// ========================================

const PROFILES = {
    viviana: {
        id: 'viviana',
        name: 'Viviana',
        avatar: 'V',
        tagline: 'Your AI companion 💕',
        status: 'online',
        color: '#E91E63',
        quizQuestions: [
            {
                question: "What's your ideal weekend?",
                choices: [
                    { text: "🏖️ Beach & Chill", value: "relaxed" },
                    { text: "🎉 Party & Friends", value: "social" },
                    { text: "📚 Reading & Netflix", value: "cozy" },
                    { text: "🏔️ Adventure & Hiking", value: "active" }
                ]
            },
            {
                question: "Pick your favorite music genre",
                choices: [
                    { text: "🎵 Pop & Charts", value: "pop" },
                    { text: "🎸 Rock & Indie", value: "rock" },
                    { text: "🎹 Classical & Jazz", value: "classical" },
                    { text: "🎧 Electronic & EDM", value: "electronic" }
                ]
            },
            {
                question: "What's your coffee order?",
                choices: [
                    { text: "☕ Black Coffee", value: "simple" },
                    { text: "🥤 Iced Latte", value: "cool" },
                    { text: "🍵 Tea Instead", value: "tea" },
                    { text: "🍫 Hot Chocolate", value: "sweet" }
                ]
            },
            {
                question: "Your dream vacation?",
                choices: [
                    { text: "🗼 Paris Romance", value: "romantic" },
                    { text: "🏝️ Tropical Island", value: "tropical" },
                    { text: "🏔️ Mountain Cabin", value: "nature" },
                    { text: "🌃 City Exploration", value: "urban" }
                ]
            },
            {
                question: "Late night activity?",
                choices: [
                    { text: "🎬 Movie Marathon", value: "movies" },
                    { text: "🎮 Gaming Session", value: "gaming" },
                    { text: "📖 Book & Wine", value: "reading" },
                    { text: "💬 Deep Conversations", value: "talking" }
                ]
            },
            {
                question: "Your love language?",
                choices: [
                    { text: "💬 Words of Affirmation", value: "words" },
                    { text: "🎁 Gifts & Surprises", value: "gifts" },
                    { text: "⏰ Quality Time", value: "time" },
                    { text: "🤗 Physical Touch", value: "touch" }
                ]
            }
        ]
    }
    // Future profiles can be added here:
    // emma: { ... },
    // sophia: { ... }
};

// ========================================
// QUIZ PROGRESS MANAGEMENT (Multi-Profile)
// ========================================

/**
 * Save quiz progress for a specific profile
 * @param {string} profileId - Profile identifier (e.g., 'viviana')
 * @param {object} progressData - Progress data {currentQuestion, answers, isUnlocked}
 */
function saveProfileQuizProgress(profileId, progressData) {
    if (!currentUser || !profileId) return;

    const key = `QUIZ_PROGRESS_${currentUser.userId}_${profileId}`;
    const data = {
        ...progressData,
        profileId: profileId,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(data));
    console.log(`💾 Quiz progress saved for ${profileId}:`, data);

    // Update open quizzes list UI
    updateOpenQuizzesList();
}

/**
 * Load quiz progress for a specific profile
 * @param {string} profileId - Profile identifier
 * @returns {object|null} Progress data or null
 */
function loadProfileQuizProgress(profileId) {
    if (!currentUser || !profileId) return null;

    const key = `QUIZ_PROGRESS_${currentUser.userId}_${profileId}`;
    const saved = localStorage.getItem(key);

    if (!saved) return null;

    try {
        const progressData = JSON.parse(saved);
        console.log(`📖 Quiz progress loaded for ${profileId}:`, progressData);
        return progressData;
    } catch (error) {
        console.error(`❌ Failed to load quiz progress for ${profileId}:`, error);
        return null;
    }
}

/**
 * Clear quiz progress for a specific profile (on completion)
 * @param {string} profileId - Profile identifier
 */
function clearProfileQuizProgress(profileId) {
    if (!currentUser || !profileId) return;

    const key = `QUIZ_PROGRESS_${currentUser.userId}_${profileId}`;
    localStorage.removeItem(key);
    console.log(`🗑️ Quiz progress cleared for ${profileId}`);

    // Update open quizzes list UI
    updateOpenQuizzesList();
}

/**
 * Get all profiles with open (incomplete) quizzes
 * @returns {Array} Array of profiles with open quizzes
 */
function getOpenQuizzes() {
    if (!currentUser) return [];

    const openQuizzes = [];

    // Check each profile for open quiz progress
    for (const [profileId, profile] of Object.entries(PROFILES)) {
        const progress = loadProfileQuizProgress(profileId);

        // Include if quiz started but not completed
        if (progress && !progress.isUnlocked) {
            const totalQuestions = profile.quizQuestions.length;
            const currentQuestion = progress.currentQuestion || 0;

            openQuizzes.push({
                profileId: profileId,
                name: profile.name,
                avatar: profile.avatar,
                color: profile.color,
                progress: {
                    current: currentQuestion + 1,
                    total: totalQuestions,
                    percentage: Math.round(((currentQuestion + 1) / totalQuestions) * 100)
                },
                lastUpdated: progress.lastUpdated
            });
        }
    }

    // Sort by last updated (most recent first)
    openQuizzes.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

    console.log('📋 Open quizzes:', openQuizzes);
    return openQuizzes;
}

// ========================================
// QUIZ MODAL INTEGRATION (Multi-Profile)
// ========================================

let currentProfileId = null; // Track which profile's quiz is currently open

/**
 * Open quiz modal for a specific profile
 * @param {string} profileId - Profile identifier
 */
function openProfileQuiz(profileId) {
    if (!currentUser) {
        showToast('Please log in to start the quiz', 'error');
        return;
    }

    const profile = PROFILES[profileId];
    if (!profile) {
        console.error(`❌ Profile not found: ${profileId}`);
        return;
    }

    console.log(`🎯 Opening quiz for profile: ${profileId}`);
    currentProfileId = profileId;

    // Get quiz container
    const quizFlow = document.getElementById('quizFlow');
    if (!quizFlow) {
        console.error('❌ Quiz container not found');
        return;
    }

    // Load saved progress for this profile
    const savedProgress = loadProfileQuizProgress(profileId);

    if (savedProgress && !savedProgress.isUnlocked) {
        // Resume from saved progress
        console.log(`🔄 Resuming quiz from question ${savedProgress.currentQuestion + 1}`);
        quizState.currentQuestion = savedProgress.currentQuestion;
        quizState.answers = savedProgress.answers || [];
        quizState.isUnlocked = savedProgress.isUnlocked || false;
    } else if (savedProgress && savedProgress.isUnlocked) {
        // User already completed quiz for this profile
        console.log('✅ User already unlocked this profile, going to chat');
        showChatState('actualChat');
        return;
    } else {
        // Start fresh quiz
        console.log('🆕 Starting new quiz');
        quizState.currentQuestion = 0;
        quizState.answers = [];
        quizState.isUnlocked = false;
    }

    // Override quiz questions with this profile's questions
    window.quizQuestions = profile.quizQuestions;

    // Show quiz modal
    quizFlow.classList.add('active');
    document.body.classList.add('quiz-open');

    // Update quiz branding with profile info
    updateQuizBranding(profile);

    // Render current question
    if (typeof renderQuestion === 'function') {
        renderQuestion();
    }

    console.log(`✅ Quiz opened for ${profile.name}`);
}

/**
 * Update quiz branding with profile-specific info
 * @param {object} profile - Profile object
 */
function updateQuizBranding(profile) {
    const brandingAvatar = document.querySelector('.quiz-branding-avatar');
    const brandingName = document.querySelector('.quiz-branding-info h3');

    if (brandingAvatar) {
        brandingAvatar.textContent = profile.avatar;
        brandingAvatar.style.background = profile.color;
    }

    if (brandingName) {
        brandingName.innerHTML = `${profile.name} <span style="color: #27ae60;">💚</span>`;
    }
}

/**
 * Close quiz modal and save progress
 */
function closeProfileQuiz() {
    if (!currentProfileId) return;

    // Save progress if quiz not completed
    if (!quizState.isUnlocked) {
        saveProfileQuizProgress(currentProfileId, {
            currentQuestion: quizState.currentQuestion,
            answers: quizState.answers,
            isUnlocked: quizState.isUnlocked
        });
    }

    // Hide quiz modal
    const quizFlow = document.getElementById('quizFlow');
    if (quizFlow) {
        quizFlow.classList.remove('active');
    }
    document.body.classList.remove('quiz-open');

    console.log(`✅ Quiz closed for profile: ${currentProfileId}`);
    currentProfileId = null;
}

// ========================================
// UI: OPEN QUIZZES LIST
// ========================================

/**
 * Update the open quizzes list in the UI
 */
function updateOpenQuizzesList() {
    const container = document.getElementById('openQuizzesList');
    if (!container) return;

    const openQuizzes = getOpenQuizzes();

    if (openQuizzes.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Build HTML for open quizzes
    let html = `
        <div class="open-quizzes-header">
            <h3>Continue Your Quizzes</h3>
            <p class="open-quizzes-subtitle">Resume where you left off</p>
        </div>
        <div class="open-quizzes-grid">
    `;

    openQuizzes.forEach(quiz => {
        html += `
            <div class="open-quiz-card" onclick="openProfileQuiz('${quiz.profileId}')">
                <div class="open-quiz-avatar" style="background: ${quiz.color};">
                    ${quiz.avatar}
                </div>
                <div class="open-quiz-info">
                    <h4>${quiz.name}</h4>
                    <p class="open-quiz-progress">
                        Question ${quiz.progress.current}/${quiz.progress.total}
                    </p>
                    <div class="open-quiz-progress-bar">
                        <div class="open-quiz-progress-fill" style="width: ${quiz.progress.percentage}%"></div>
                    </div>
                </div>
                <div class="open-quiz-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            </div>
        `;
    });

    html += `
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
}

/**
 * Initialize open quizzes list on page load
 */
function initOpenQuizzesList() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateOpenQuizzesList);
    } else {
        updateOpenQuizzesList();
    }
}

// Auto-initialize
initOpenQuizzesList();

// ========================================
// OVERRIDE ORIGINAL QUIZ FUNCTIONS
// ========================================

// Override original startQuiz to use profile system
if (typeof window.startQuiz !== 'undefined') {
    window._originalStartQuiz = window.startQuiz;
}

window.startQuiz = function() {
    // Default to Viviana profile
    openProfileQuiz('viviana');
};

// Override original save/load/clear functions
if (typeof window.saveQuizProgress !== 'undefined') {
    window._originalSaveQuizProgress = window.saveQuizProgress;
}

window.saveQuizProgress = function() {
    if (currentProfileId) {
        saveProfileQuizProgress(currentProfileId, {
            currentQuestion: quizState.currentQuestion,
            answers: quizState.answers,
            isUnlocked: quizState.isUnlocked
        });
    }
};

if (typeof window.clearQuizProgress !== 'undefined') {
    window._originalClearQuizProgress = window.clearQuizProgress;
}

window.clearQuizProgress = function() {
    if (currentProfileId) {
        clearProfileQuizProgress(currentProfileId);
    }
};

// Override closeQuizModal to use profile system
if (typeof window.closeQuizModal !== 'undefined') {
    window._originalCloseQuizModal = window.closeQuizModal;
}

window.closeQuizModal = function() {
    closeProfileQuiz();

    // Also call original if needed for backward compatibility
    if (window._originalCloseQuizModal && typeof window._originalCloseQuizModal === 'function') {
        // Original function handles UI cleanup, let it do its job
        // But skip the save part since we already saved in closeProfileQuiz
    }
};

// Override backToProfileSelection to handle profile context
if (typeof window.backToProfileSelection !== 'undefined') {
    window._originalBackToProfileSelection = window.backToProfileSelection;
}

window.backToProfileSelection = function() {
    // Save progress before going back
    if (currentProfileId && !quizState.isUnlocked) {
        saveProfileQuizProgress(currentProfileId, {
            currentQuestion: quizState.currentQuestion,
            answers: quizState.answers,
            isUnlocked: quizState.isUnlocked
        });
    }

    // Close quiz
    const quizFlow = document.getElementById('quizFlow');
    if (quizFlow) {
        quizFlow.classList.remove('active');
    }
    document.body.classList.remove('quiz-open');

    // Reset current profile
    currentProfileId = null;

    // Show profile selection
    if (typeof showChatState === 'function') {
        showChatState('profileSelection');
    }
};

console.log('✅ Profile Quiz System initialized');
