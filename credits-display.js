/* ============================================
   CREDITS DISPLAY UPDATE
   Syncs credits display in profile section
   ============================================ */

/**
 * Update credits display in profile
 */
function updateProfileCreditsDisplay() {
    const creditsElement = document.getElementById('profileCreditsCount');
    if (!creditsElement) return;

    // Get current credits from localStorage
    const credits = localStorage.getItem('vivianaCredits');
    if (credits) {
        creditsElement.textContent = credits;
    }
}

/**
 * Initialize credits display
 */
function initCreditsDisplay() {
    // Update on page load
    updateProfileCreditsDisplay();

    // Update when user switches to profile screen
    const profileScreen = document.getElementById('profileScreen');
    if (profileScreen) {
        // Use MutationObserver to detect when profile screen becomes visible
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style') {
                    const isVisible = !profileScreen.style.display || profileScreen.style.display !== 'none';
                    if (isVisible) {
                        updateProfileCreditsDisplay();
                    }
                }
            });
        });

        observer.observe(profileScreen, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    // Update when credits change in localStorage
    window.addEventListener('storage', (e) => {
        if (e.key === 'vivianaCredits') {
            updateProfileCreditsDisplay();
        }
    });

    // Also listen for custom event (if other code dispatches it)
    window.addEventListener('creditsUpdated', updateProfileCreditsDisplay);
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCreditsDisplay);
} else {
    initCreditsDisplay();
}

// Make function globally available
window.updateProfileCreditsDisplay = updateProfileCreditsDisplay;

console.log('✅ Credits Display initialized');
