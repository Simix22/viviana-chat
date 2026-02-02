/* ============================================
   QUIZ MODAL FIX - Persistent State & Modal Behavior
   Fixes quiz persistence, modal opening/closing
   ============================================ */

// ========================================
// QUIZ STATE PERSISTENCE
// ========================================

// Save quiz progress to localStorage
function saveQuizProgress() {
    if (!currentUser) return;

    const progressData = {
        currentQuestion: quizState.currentQuestion,
        answers: quizState.answers,
        isUnlocked: quizState.isUnlocked,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(`VIVIANA_${currentUser.userId}_QUIZ_PROGRESS`, JSON.stringify(progressData));
    console.log('💾 Quiz progress saved:', progressData);
}

// Load quiz progress from localStorage
function loadQuizProgress() {
    if (!currentUser) return null;

    const saved = localStorage.getItem(`VIVIANA_${currentUser.userId}_QUIZ_PROGRESS`);
    if (!saved) return null;

    try {
        const progressData = JSON.parse(saved);
        console.log('📖 Quiz progress loaded:', progressData);
        return progressData;
    } catch (error) {
        console.error('❌ Failed to load quiz progress:', error);
        return null;
    }
}

// Clear quiz progress (on completion)
function clearQuizProgress() {
    if (!currentUser) return;

    localStorage.removeItem(`VIVIANA_${currentUser.userId}_QUIZ_PROGRESS`);
    console.log('🗑️ Quiz progress cleared');
}

// ========================================
// QUIZ MODAL MANAGEMENT
// ========================================

// Open quiz modal (fullscreen overlay)
function openQuizModal() {
    if (!currentUser) {
        showToast('Please log in to start the quiz', 'error');
        return;
    }

    console.log('🎯 Opening quiz modal');

    // Get quiz container
    const quizFlow = document.getElementById('quizFlow');
    if (!quizFlow) {
        console.error('❌ Quiz container not found');
        return;
    }

    // Load saved progress
    const savedProgress = loadQuizProgress();

    if (savedProgress && !savedProgress.isUnlocked) {
        // Resume from saved progress
        console.log('🔄 Resuming quiz from question', savedProgress.currentQuestion + 1);
        quizState.currentQuestion = savedProgress.currentQuestion;
        quizState.answers = savedProgress.answers || [];
        quizState.isUnlocked = savedProgress.isUnlocked || false;
    } else if (savedProgress && savedProgress.isUnlocked) {
        // User already completed quiz
        console.log('✅ User already unlocked, skipping quiz');
        showChatState('actualChat');
        return;
    } else {
        // Start fresh
        console.log('🆕 Starting new quiz');
        quizState.currentQuestion = 0;
        quizState.answers = [];
        quizState.isUnlocked = false;
    }

    // Show quiz modal
    quizFlow.classList.add('active');
    document.body.classList.add('quiz-open'); // Prevent body scroll

    // Render current question
    if (typeof renderQuestion === 'function') {
        renderQuestion();
    }

    // Hide chat states
    hideAllChatStates();
}

// Close quiz modal (save progress)
function closeQuizModal() {
    console.log('🚪 Closing quiz modal');

    // Get quiz container
    const quizFlow = document.getElementById('quizFlow');
    if (!quizFlow) return;

    // Save progress before closing (if not completed)
    if (!quizState.isUnlocked) {
        saveQuizProgress();
    }

    // Hide quiz modal
    quizFlow.classList.remove('active');
    document.body.classList.remove('quiz-open');

    // Return to profile selection
    showChatState('profileSelection');
}

// Hide all chat states
function hideAllChatStates() {
    const states = ['profileSelection', 'actualChat'];
    states.forEach(stateId => {
        const element = document.getElementById(stateId);
        if (element) {
            element.style.display = 'none';
        }
    });
}

// ========================================
// OVERRIDE ORIGINAL QUIZ FUNCTIONS
// ========================================

// Store original functions
const _originalStartQuiz = typeof startQuiz !== 'undefined' ? startQuiz : null;
const _originalBackToProfileSelection = typeof backToProfileSelection !== 'undefined' ? backToProfileSelection : null;
const _originalSelectChoice = typeof selectChoice !== 'undefined' ? selectChoice : null;

// Override startQuiz to use modal
window.startQuiz = function() {
    console.log('🎮 startQuiz called (using modal version)');
    openQuizModal();
};

// Override backToProfileSelection to close modal
window.backToProfileSelection = function() {
    console.log('⬅️ backToProfileSelection called');
    closeQuizModal();
};

// Override selectChoice to save progress after each answer
if (_originalSelectChoice) {
    window.selectChoice = function(choiceIndex) {
        // Call original function
        _originalSelectChoice(choiceIndex);

        // Save progress after short delay (after answer is stored)
        setTimeout(() => {
            saveQuizProgress();
        }, 100);
    };
}

// ========================================
// ENHANCED selectChoiceEnhanced (from quiz-polish.js)
// ========================================

// If quiz-polish.js defined selectChoiceEnhanced, wrap it
if (typeof selectChoiceEnhanced !== 'undefined') {
    const _originalSelectChoiceEnhanced = selectChoiceEnhanced;

    window.selectChoiceEnhanced = function(choiceIndex, cardElement) {
        // Call original enhanced function
        _originalSelectChoiceEnhanced(choiceIndex, cardElement);

        // Save progress after animation
        setTimeout(() => {
            saveQuizProgress();
        }, 500);
    };
}

// ========================================
// ENHANCED FINISH QUIZ (CLEAR PROGRESS ON COMPLETION)
// ========================================

// Override finishQuiz to clear progress
if (typeof finishQuizEnhanced !== 'undefined') {
    const _originalFinishQuizEnhanced = finishQuizEnhanced;

    window.finishQuizEnhanced = async function() {
        console.log('🎉 Quiz completed! Clearing progress...');

        // Clear saved progress (quiz is done)
        clearQuizProgress();

        // Call original function
        await _originalFinishQuizEnhanced();

        // Close quiz modal after unlock modal is shown
        const quizFlow = document.getElementById('quizFlow');
        if (quizFlow) {
            quizFlow.classList.remove('active');
        }
        document.body.classList.remove('quiz-open');
    };
}

// ========================================
// PROFILE CARD CLICK HANDLER
// ========================================

// Ensure quiz only opens via profile card click
function setupProfileCardClick() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupProfileCardClick);
        return;
    }

    // Find profile card (the one that triggers quiz)
    const profileCard = document.querySelector('.profile-card');

    if (profileCard) {
        // Remove any existing onclick
        profileCard.removeAttribute('onclick');

        // Add new click handler
        profileCard.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎴 Profile card clicked - opening quiz');
            openQuizModal();
        });

        console.log('✅ Profile card click handler installed');
    }
}

// Initialize on load
setupProfileCardClick();

// ========================================
// CHECK UNLOCK STATUS ON CHAT INIT
// ========================================

// When showing chat, check if user is already unlocked
const _originalShowChatState = typeof showChatState !== 'undefined' ? showChatState : null;

if (_originalShowChatState) {
    window.showChatState = function(stateName) {
        // If trying to show actualChat, check unlock status first
        if (stateName === 'actualChat') {
            if (!currentUser) {
                console.warn('⚠️ No current user, cannot show chat');
                return;
            }

            // Check if user is unlocked
            const unlocked = localStorage.getItem(`VIVIANA_${currentUser.userId}_UNLOCKED`);
            const savedProgress = loadQuizProgress();

            if (unlocked !== 'true' && (!savedProgress || !savedProgress.isUnlocked)) {
                console.log('🔒 User not unlocked, showing profile selection');
                _originalShowChatState('profileSelection');
                return;
            }
        }

        // Call original function
        _originalShowChatState(stateName);
    };
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

// Close quiz on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const quizFlow = document.getElementById('quizFlow');
        if (quizFlow && quizFlow.classList.contains('active')) {
            console.log('⌨️ Escape pressed - closing quiz');
            closeQuizModal();
        }
    }
});

// ========================================
// DEBUGGING HELPERS
// ========================================

// Expose functions globally for debugging
window.openQuizModal = openQuizModal;
window.closeQuizModal = closeQuizModal;
window.saveQuizProgress = saveQuizProgress;
window.loadQuizProgress = loadQuizProgress;
window.clearQuizProgress = clearQuizProgress;

console.log('✅ Quiz modal fix loaded');
