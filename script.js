// ========================================
// VIVIANA APP - FINAL VERSION
// ========================================

let currentUser = null;
let pendingVerificationEmail = null;
let verificationCode = null;
let verificationCodeExpiry = null;
let resendCooldownUntil = null;

// Password Reset
let passwordResetEmail = null;
let passwordResetCode = null;
let passwordResetCodeExpiry = null;
let passwordResetCooldownUntil = null;

// Payment Processing
const PAYMENT_WEBHOOKS = []; // In production: registered webhook URLs

// Rate Limiting
const rateLimits = {
    login: { attempts: 0, resetAt: 0, maxAttempts: 5, windowMs: 15 * 60 * 1000 },
    signup: { attempts: 0, resetAt: 0, maxAttempts: 3, windowMs: 60 * 60 * 1000 },
    verification: { attempts: 0, resetAt: 0, maxAttempts: 5, windowMs: 15 * 60 * 1000 },
    message: { attempts: 0, resetAt: 0, maxAttempts: 20, windowMs: 60 * 1000 }
};

// ========================================
// FIREBASE CONFIGURATION
// ========================================

// Firebase configuration object
// Your Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyCdawsYskL8o8-tFbVMpxGxyf_wKwFLKh8",
    authDomain: "viviana-chat.firebaseapp.com",
    projectId: "viviana-chat",
    storageBucket: "viviana-chat.firebasestorage.app",
    messagingSenderId: "866368620130",
    appId: "1:866368620130:web:dee36a1dda38c0708df33b"
};

// Initialize Firebase
let firebaseApp = null;
let firebaseAuth = null;

try {
    // Check if Firebase is loaded
    if (typeof firebase !== 'undefined') {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        console.log('✅ Firebase initialized successfully');

        // Set up auth state observer
        firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                console.log('🔐 Firebase user detected:', user.email);
                // User is signed in with Firebase
                // The handleGoogleLogin function will handle the rest
            } else {
                console.log('🔓 No Firebase user signed in');
            }
        });
    } else {
        console.warn('⚠️ Firebase SDK not loaded. Google Sign-In will not work.');
    }
} catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.log('💡 Please configure your Firebase credentials in script.js');
}

// ========================================
// RATE LIMITING & ABUSE PREVENTION
// ========================================

function checkRateLimit(type) {
    const limit = rateLimits[type];
    const now = Date.now();

    // Reset if window expired
    if (now > limit.resetAt) {
        limit.attempts = 0;
        limit.resetAt = now + limit.windowMs;
    }

    // Check if exceeded
    if (limit.attempts >= limit.maxAttempts) {
        const waitMinutes = Math.ceil((limit.resetAt - now) / 60000);
        return { allowed: false, waitMinutes };
    }

    // Increment
    limit.attempts++;
    return { allowed: true };
}

function logSecurityEvent(type, details) {
    const events = JSON.parse(localStorage.getItem('VIVIANA_SECURITY_LOG') || '[]');
    events.push({
        type,
        details,
        timestamp: new Date().toISOString(),
        ip: 'demo' // In production: actual IP
    });

    // Keep last 1000 events
    if (events.length > 1000) events.shift();

    localStorage.setItem('VIVIANA_SECURITY_LOG', JSON.stringify(events));
}

// ========================================
// CREDITS LEDGER SYSTEM
// ========================================

function getCreditsLedger(userId) {
    const ledger = localStorage.getItem(`VIVIANA_${userId}_CREDITS_LEDGER`);
    return ledger ? JSON.parse(ledger) : [];
}

function addCreditsLedgerEntry(userId, event) {
    const ledger = getCreditsLedger(userId);

    const entry = {
        id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        event_type: event.type, // 'purchase', 'spend', 'admin_adjust', 'refund'
        amount: event.amount, // positive for credit, negative for debit
        balance_before: event.balance_before,
        balance_after: event.balance_after,
        description: event.description,
        metadata: event.metadata || {} // payment_id, message_id, admin_id, etc.
    };

    ledger.push(entry);
    localStorage.setItem(`VIVIANA_${userId}_CREDITS_LEDGER`, JSON.stringify(ledger));

    console.log('💳 Ledger entry added:', entry);
    return entry;
}

function getCreditsBalance(userId) {
    return parseInt(localStorage.getItem(`VIVIANA_${userId}_CREDITS`) || '0');
}

function updateCreditsBalance(userId, newBalance) {
    localStorage.setItem(`VIVIANA_${userId}_CREDITS`, newBalance.toString());
}

function creditsPurchase(userId, amount, price, paymentId) {
    const balanceBefore = getCreditsBalance(userId);
    const balanceAfter = balanceBefore + amount;

    updateCreditsBalance(userId, balanceAfter);

    addCreditsLedgerEntry(userId, {
        type: 'purchase',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Purchased ${amount} credits for ${price}`,
        metadata: { payment_id: paymentId, price: price }
    });

    return balanceAfter;
}

function creditsSpend(userId, amount, reason, metadata = {}) {
    const balanceBefore = getCreditsBalance(userId);

    if (balanceBefore < amount) {
        return { success: false, error: 'Insufficient credits' };
    }

    const balanceAfter = balanceBefore - amount;
    updateCreditsBalance(userId, balanceAfter);

    addCreditsLedgerEntry(userId, {
        type: 'spend',
        amount: -amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        metadata: metadata
    });

    return { success: true, balance: balanceAfter };
}

function creditsAdminAdjust(userId, amount, reason, adminId) {
    const balanceBefore = getCreditsBalance(userId);
    const balanceAfter = balanceBefore + amount;

    updateCreditsBalance(userId, balanceAfter);

    addCreditsLedgerEntry(userId, {
        type: 'admin_adjust',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        metadata: { admin_id: adminId }
    });

    logSecurityEvent('credits_adjusted', { userId, amount, reason, adminId });

    return balanceAfter;
}

function creditsRefund(userId, amount, reason, originalTxnId) {
    const balanceBefore = getCreditsBalance(userId);
    const balanceAfter = balanceBefore + amount;

    updateCreditsBalance(userId, balanceAfter);

    addCreditsLedgerEntry(userId, {
        type: 'refund',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        metadata: { original_txn_id: originalTxnId }
    });

    return balanceAfter;
}

// ========================================
// CORE FUNCTIONS
// ========================================

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function saveUserToDatabase(userId, name, email, password, emailVerified = false) {
    // Get all users
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');

    // Add new user
    allUsers[userId] = {
        name: name,
        email: email,
        password: password,
        emailVerified: emailVerified, // NEW: Track verification status
        createdAt: new Date().toISOString()
    };

    // Save back
    localStorage.setItem('VIVIANA_USERS', JSON.stringify(allUsers));

    console.log('✅ User saved to VIVIANA_USERS:', userId);
    console.log('Email verified:', emailVerified);
    console.log('Total users now:', Object.keys(allUsers).length);
}

function getUserFromDatabase(userId) {
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    return allUsers[userId] || null;
}

function findUserByEmail(email) {
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');

    for (let userId in allUsers) {
        if (allUsers[userId].email === email) {
            return { userId, ...allUsers[userId] };
        }
    }

    return null;
}

// ========================================
// DATA CONSISTENCY & INTEGRITY
// ========================================

function purgeUserByEmail(email) {
    console.log('🗑️ PURGE: Searching for user with email:', email);

    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    let foundUserId = null;

    // Find user by email
    for (let userId in users) {
        if (users[userId].email === email.toLowerCase()) {
            foundUserId = userId;
            break;
        }
    }

    if (!foundUserId) {
        console.log('✅ No user found with email:', email);
        return { found: false, message: 'No user found' };
    }

    console.log('🔍 Found user ID:', foundUserId);
    console.log('🗑️ Starting complete purge...');

    let deletedItems = 0;

    // 1. Remove from VIVIANA_USERS
    delete users[foundUserId];
    localStorage.setItem('VIVIANA_USERS', JSON.stringify(users));
    deletedItems++;
    console.log('✅ Removed from VIVIANA_USERS');

    // 2. Remove all user-specific data
    const keysToRemove = [
        `VIVIANA_${foundUserId}_CREDITS`,
        `VIVIANA_${foundUserId}_CREDITS_LEDGER`,
        `VIVIANA_${foundUserId}_BIO`,
        `VIVIANA_${foundUserId}_PROFILE_PIC`,
        `VIVIANA_${foundUserId}_MESSAGES`,
        `VIVIANA_${foundUserId}_LAST_LOGIN`,
        `VIVIANA_${foundUserId}_EMAIL_VERIFIED`,
        `VIVIANA_${foundUserId}_STATUS`
    ];

    keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            deletedItems++;
            console.log('✅ Removed:', key);
        }
    });

    // 3. Search for any remaining references with this userId
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.includes(foundUserId)) {
            localStorage.removeItem(key);
            deletedItems++;
            console.log('✅ Removed orphaned key:', key);
        }
    }

    // 4. Clean up payments with this userId
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('VIVIANA_PAYMENT_')) {
            try {
                const paymentData = JSON.parse(localStorage.getItem(key));
                if (paymentData.userId === foundUserId) {
                    localStorage.removeItem(key);
                    deletedItems++;
                    console.log('✅ Removed payment:', key);
                }
            } catch (e) {
                // Invalid payment data, skip
            }
        }
    }

    // 5. Clean security logs (anonymize, don't delete for audit trail)
    try {
        const securityLog = JSON.parse(localStorage.getItem('VIVIANA_SECURITY_LOG') || '[]');
        const cleanedLog = securityLog.map(event => {
            if (event.details && event.details.email === email.toLowerCase()) {
                event.details.email = '[PURGED]';
                event.details.userId = '[PURGED]';
            }
            if (event.details && event.details.userId === foundUserId) {
                event.details.userId = '[PURGED]';
            }
            return event;
        });
        localStorage.setItem('VIVIANA_SECURITY_LOG', JSON.stringify(cleanedLog));
        console.log('✅ Anonymized security logs');
    } catch (e) {
        console.error('❌ Error cleaning security logs:', e);
    }

    // 6. Clean webhook logs
    try {
        const webhookLog = JSON.parse(localStorage.getItem('VIVIANA_WEBHOOK_LOG') || '[]');
        const cleanedWebhooks = webhookLog.filter(event => {
            return !(event.data && event.data.object && event.data.object.userId === foundUserId);
        });
        localStorage.setItem('VIVIANA_WEBHOOK_LOG', JSON.stringify(cleanedWebhooks));
        console.log('✅ Cleaned webhook logs');
    } catch (e) {
        console.error('❌ Error cleaning webhook logs:', e);
    }

    // 7. If this is the current user, log them out
    const currentUserId = localStorage.getItem('VIVIANA_CURRENT_USER_ID');
    if (currentUserId === foundUserId) {
        localStorage.removeItem('VIVIANA_CURRENT_USER_ID');
        console.log('✅ Logged out purged user');
    }

    console.log('');
    console.log('==============================================');
    console.log('🗑️ PURGE COMPLETE');
    console.log('==============================================');
    console.log('Email:', email);
    console.log('User ID:', foundUserId);
    console.log('Items deleted:', deletedItems);
    console.log('==============================================');
    console.log('');

    // Log the purge event
    logSecurityEvent('user_purged', { email: '[PURGED]', userId: '[PURGED]', itemsDeleted: deletedItems });

    return {
        found: true,
        userId: foundUserId,
        itemsDeleted: deletedItems,
        message: 'User completely purged from system'
    };
}

function searchUserReferences(email) {
    console.log('🔍 SEARCH: Looking for all references to:', email);

    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    let foundUserId = null;

    // Find user by email
    for (let userId in users) {
        if (users[userId].email === email.toLowerCase()) {
            foundUserId = userId;
            break;
        }
    }

    if (!foundUserId) {
        console.log('✅ No user found with email:', email);
        return { found: false, references: [] };
    }

    const references = [];

    // Check all possible locations
    const possibleKeys = [
        `VIVIANA_${foundUserId}_CREDITS`,
        `VIVIANA_${foundUserId}_CREDITS_LEDGER`,
        `VIVIANA_${foundUserId}_BIO`,
        `VIVIANA_${foundUserId}_PROFILE_PIC`,
        `VIVIANA_${foundUserId}_MESSAGES`,
        `VIVIANA_${foundUserId}_LAST_LOGIN`,
        `VIVIANA_${foundUserId}_EMAIL_VERIFIED`,
        `VIVIANA_${foundUserId}_STATUS`
    ];

    possibleKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            references.push({ type: 'localStorage', key: key, value: localStorage.getItem(key) });
        }
    });

    // Check VIVIANA_USERS
    if (users[foundUserId]) {
        references.push({ type: 'VIVIANA_USERS', key: foundUserId, value: users[foundUserId] });
    }

    // Check payments
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('VIVIANA_PAYMENT_')) {
            try {
                const paymentData = JSON.parse(localStorage.getItem(key));
                if (paymentData.userId === foundUserId) {
                    references.push({ type: 'payment', key: key, value: paymentData });
                }
            } catch (e) {
                // Skip invalid data
            }
        }
    }

    // Check security logs
    try {
        const securityLog = JSON.parse(localStorage.getItem('VIVIANA_SECURITY_LOG') || '[]');
        const matchingLogs = securityLog.filter(event => {
            return (event.details && (event.details.email === email.toLowerCase() || event.details.userId === foundUserId));
        });
        if (matchingLogs.length > 0) {
            references.push({ type: 'security_log', key: 'VIVIANA_SECURITY_LOG', count: matchingLogs.length });
        }
    } catch (e) {
        // Skip
    }

    console.log('Found', references.length, 'references');
    references.forEach(ref => console.log('-', ref.type, ':', ref.key));

    return { found: true, userId: foundUserId, references: references };
}

function checkDataConsistency() {
    console.log('🔍 Checking data consistency...');

    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    let fixesApplied = 0;

    Object.keys(users).forEach(userId => {
        const user = users[userId];

        // Ensure emailVerified field exists
        if (user.emailVerified === undefined) {
            user.emailVerified = false;
            fixesApplied++;
            console.log('⚠️ Fixed missing emailVerified for user:', userId);
        }

        // Ensure credits exist
        const credits = localStorage.getItem(`VIVIANA_${userId}_CREDITS`);
        if (!credits) {
            localStorage.setItem(`VIVIANA_${userId}_CREDITS`, '0');
            fixesApplied++;
            console.log('⚠️ Fixed missing credits for user:', userId);
        }

        // Ensure status exists
        const status = localStorage.getItem(`VIVIANA_${userId}_STATUS`);
        if (!status) {
            localStorage.setItem(`VIVIANA_${userId}_STATUS`, 'active');
            fixesApplied++;
            console.log('⚠️ Fixed missing status for user:', userId);
        }

        // Ensure messages array exists
        const messages = localStorage.getItem(`VIVIANA_${userId}_MESSAGES`);
        if (!messages) {
            localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, '[]');
            fixesApplied++;
            console.log('⚠️ Fixed missing messages for user:', userId);
        }

        // Ensure ledger exists
        const ledger = localStorage.getItem(`VIVIANA_${userId}_CREDITS_LEDGER`);
        if (!ledger) {
            localStorage.setItem(`VIVIANA_${userId}_CREDITS_LEDGER`, '[]');
            fixesApplied++;
            console.log('⚠️ Fixed missing ledger for user:', userId);
        }

        // Validate messages format (ensure all have id, sender_type)
        try {
            const messageData = JSON.parse(localStorage.getItem(`VIVIANA_${userId}_MESSAGES`) || '[]');
            let messagesFixed = false;

            messageData.forEach(msg => {
                if (!msg.id) {
                    msg.id = 'msg_legacy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    messagesFixed = true;
                }
                if (!msg.sender_type) {
                    msg.sender_type = msg.type === 'sent' ? 'user' : 'viviana';
                    messagesFixed = true;
                }
                if (msg.read === undefined) {
                    msg.read = true; // Assume old messages are read
                    messagesFixed = true;
                }
            });

            if (messagesFixed) {
                localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, JSON.stringify(messageData));
                fixesApplied++;
                console.log('⚠️ Fixed message format for user:', userId);
            }
        } catch (e) {
            console.error('❌ Error validating messages for user:', userId, e);
        }
    });

    // Save any fixes to VIVIANA_USERS
    localStorage.setItem('VIVIANA_USERS', JSON.stringify(users));

    if (fixesApplied > 0) {
        console.log(`✅ Data consistency check complete - ${fixesApplied} fixes applied`);
    } else {
        console.log('✅ Data consistency check complete - no issues found');
    }
}

function cleanupOrphanedData() {
    console.log('🧹 Cleaning up orphaned data...');

    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    const userIds = Object.keys(users);

    let cleanedCount = 0;

    // Find all VIVIANA_ keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('VIVIANA_') && !key.startsWith('VIVIANA_USERS') && !key.startsWith('VIVIANA_SECURITY_LOG') && !key.startsWith('VIVIANA_WEBHOOK_LOG') && !key.startsWith('VIVIANA_PAYMENT_')) {
            // Extract userId from key (format: VIVIANA_{userId}_*)
            const parts = key.split('_');
            if (parts.length >= 3) {
                const possibleUserId = parts[1] + '_' + parts[2];

                // Check if this userId exists in VIVIANA_USERS
                if (possibleUserId.startsWith('user_') && !userIds.includes(possibleUserId)) {
                    console.log('🗑️ Removing orphaned data:', key);
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            }
        }
    }

    if (cleanedCount > 0) {
        console.log(`✅ Cleanup complete - ${cleanedCount} orphaned entries removed`);
    } else {
        console.log('✅ Cleanup complete - no orphaned data found');
    }
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Viviana App Starting');

    // Check data consistency and cleanup orphaned data
    checkDataConsistency();
    cleanupOrphanedData();

    // CRITICAL: Ensure all screens are hidden initially
    hideAllScreens();

    // Check if user is logged in
    const savedUserId = localStorage.getItem('VIVIANA_CURRENT_USER_ID');
    console.log('🔍 Checking for saved user ID:', savedUserId);

    if (savedUserId) {
        const userData = getUserFromDatabase(savedUserId);
        console.log('🔍 User data from database:', userData);

        if (userData) {
            // Check if email is verified
            console.log('🔍 Email verified status:', userData.emailVerified);
            if (!userData.emailVerified) {
                console.log('⚠️ Email not verified, redirecting to verification');
                console.log('⚠️ User data:', JSON.stringify(userData));
                localStorage.removeItem('VIVIANA_CURRENT_USER_ID');
                showWelcome();
                return;
            }

            currentUser = { userId: savedUserId, ...userData };
            console.log('✅ User logged in:', currentUser.email);
            console.log('✅ Calling showChat() from DOMContentLoaded...');
            showChat();
            console.log('✅ Calling loadProfile() from DOMContentLoaded...');
            loadProfile();
        } else {
            console.log('⚠️ Saved user ID not found, showing welcome');
            localStorage.removeItem('VIVIANA_CURRENT_USER_ID');
            showWelcome();
        }
    } else {
        console.log('👋 No saved user, showing welcome');
        showWelcome();
    }

    // Setup forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordResetRequestForm').addEventListener('submit', handlePasswordResetRequest);
    document.getElementById('passwordResetVerifyForm').addEventListener('submit', handlePasswordResetVerify);

    // Enter key for messages
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    console.log('✅ App initialization complete');
});

// ========================================
// NAVIGATION
// ========================================

function hideAllScreens() {
    // Force hide all screens completely
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    console.log('🔒 All screens hidden');
}

function showWelcome() {
    console.log('📱 Showing Welcome Screen');
    hideAllScreens();
    const welcomeScreen = document.getElementById('welcomeScreen');
    welcomeScreen.style.display = 'flex';
    welcomeScreen.classList.add('active');
}

function showAuth() {
    console.log('🔐 Showing Auth Screen');
    hideAllScreens();
    const authScreen = document.getElementById('authScreen');
    authScreen.style.display = 'flex';
    authScreen.classList.add('active');
}

function showVerificationScreenNav() {
    console.log('📧 Showing Verification Screen');
    hideAllScreens();
    const verificationScreen = document.getElementById('verificationScreen');
    verificationScreen.style.display = 'flex';
    verificationScreen.classList.add('active');
}

function showChat() {
    console.log('💬 Showing Chat Screen');

    if (!currentUser) {
        console.error('❌ Cannot show chat: currentUser is not set');
        showWelcome();
        return;
    }

    console.log('✅ currentUser verified:', currentUser.email);

    hideAllScreens();
    const chatScreen = document.getElementById('chatScreen');
    chatScreen.style.display = 'flex';
    chatScreen.classList.add('active');
    updateCreditsDisplay();
    updateNavButtons('chat');
    loadAdminMessages();

    console.log('✅ Chat screen displayed');

    // Start auto-refresh for new messages from Viviana
    startMessageRefresh();
}

// Auto-refresh messages every 3 seconds to show new Viviana replies
let messageRefreshInterval = null;

function startMessageRefresh() {
    // Clear any existing interval
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
    }

    // Refresh messages every 3 seconds
    messageRefreshInterval = setInterval(() => {
        if (currentUser && document.getElementById('chatScreen').classList.contains('active')) {
            const container = document.getElementById('chatMessages');
            const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

            loadAdminMessages();

            // Auto-scroll to bottom if user was already at bottom
            if (wasAtBottom) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }, 3000);
}

function stopMessageRefresh() {
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
        messageRefreshInterval = null;
    }
}

function showCreditsStore() {
    console.log('💰 Showing Credits Store');
    hideAllScreens();
    const creditsScreen = document.getElementById('creditsScreen');
    creditsScreen.style.display = 'flex';
    creditsScreen.classList.add('active');
    updateNavButtons('credits');
    // Update credits display in store
    const storeCreditsCount = document.getElementById('storeCreditsCount');
    if (storeCreditsCount && currentUser) {
        const credits = localStorage.getItem(`VIVIANA_${currentUser.userId}_CREDITS`) || '0';
        storeCreditsCount.textContent = credits;
    }
}

function showProfile() {
    console.log('👤 Showing Profile Screen');
    hideAllScreens();
    const profileScreen = document.getElementById('profileScreen');
    profileScreen.style.display = 'flex';
    profileScreen.classList.add('active');
    updateNavButtons('profile');
    loadProfile();
}

function updateNavButtons(active) {
    console.log('🔄 Updating nav buttons, active:', active);

    // Remove active from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => btn.classList.remove('active'));

    // Add active to the current section
    try {
        if (active === 'chat') {
            const chatBtn = document.querySelector('[onclick="showChat()"]');
            if (chatBtn) chatBtn.classList.add('active');
        }
        if (active === 'credits') {
            const creditsBtn = document.querySelector('[onclick="showCreditsStore()"]');
            if (creditsBtn) creditsBtn.classList.add('active');
        }
        if (active === 'profile') {
            const profileBtn = document.querySelector('[onclick="showProfile()"]');
            if (profileBtn) profileBtn.classList.add('active');
        }
    } catch (error) {
        console.error('Error updating nav buttons:', error);
    }
}

function switchToSignup() {
    console.log('🔄 Switching to Signup');
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('signupForm').classList.add('active');
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('signupTab').classList.add('active');
}

function switchToLogin() {
    console.log('🔄 Switching to Login');
    document.getElementById('signupForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('signupTab').classList.remove('active');
    document.getElementById('loginTab').classList.add('active');
}

// ========================================
// AUTHENTICATION
// ========================================

function handleLogin(e) {
    e.preventDefault();

    // Rate limiting
    const rateCheck = checkRateLimit('login');
    if (!rateCheck.allowed) {
        showToast(`Too many login attempts. Try again in ${rateCheck.waitMinutes} minutes.`, 'error');
        logSecurityEvent('rate_limit_exceeded', { type: 'login' });
        return;
    }

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    const user = findUserByEmail(email);

    if (!user || user.password !== password) {
        showToast('Invalid email or password', 'error');
        logSecurityEvent('failed_login', { email });
        return;
    }

    // CHECK EMAIL VERIFICATION
    if (!user.emailVerified) {
        console.log('⚠️ Email not verified for user:', user.email);
        showToast('Please verify your email before logging in', 'error');

        // Set pending verification
        pendingVerificationEmail = user.email;
        currentUser = user;

        // Generate new code
        generateVerificationCode();

        // Clear form
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';

        // Show verification screen
        setTimeout(() => {
            showVerificationScreen();
        }, 1000);

        return;
    }

    // Login successful
    currentUser = user;
    localStorage.setItem('VIVIANA_CURRENT_USER_ID', user.userId);
    localStorage.setItem(`VIVIANA_${user.userId}_LAST_LOGIN`, new Date().toISOString());

    console.log('✅ Login successful:', user.email);
    logSecurityEvent('login_success', { email: user.email, userId: user.userId });
    showToast('Welcome back!', 'success');

    // Clear form
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';

    // Navigate to chat after a brief delay
    setTimeout(() => {
        console.log('🔄 Navigating to chat...');
        showChat();
    }, 500);
}

function handleSignup(e) {
    e.preventDefault();

    // Rate limiting
    const rateCheck = checkRateLimit('signup');
    if (!rateCheck.allowed) {
        showToast(`Too many signup attempts. Try again in ${rateCheck.waitMinutes} minutes.`, 'error');
        logSecurityEvent('rate_limit_exceeded', { type: 'signup' });
        return;
    }

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;

    console.log('📝 Signup attempt:', { name, email });

    if (!name || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    // CRITICAL: Check for ANY existing references to this email
    const searchResult = searchUserReferences(email);
    if (searchResult.found) {
        console.error('⚠️ CRITICAL: Email already exists in system!');
        console.error('User ID:', searchResult.userId);
        console.error('References:', searchResult.references.length);

        showToast('Account with this email already exists', 'error');
        logSecurityEvent('signup_failed', { email, reason: 'email_exists', existingUserId: searchResult.userId });

        // Alert admin that cleanup may be needed
        console.error('⚠️ Run purgeUserByEmail("' + email + '") to clean up ghost account');
        return;
    }

    // Double-check with legacy method
    const existingUser = findUserByEmail(email);
    if (existingUser) {
        console.error('⚠️ CRITICAL: Legacy check found existing user!');
        showToast('Account with this email already exists', 'error');
        logSecurityEvent('signup_failed', { email, reason: 'email_exists_legacy' });
        return;
    }

    // Create new user (NOT VERIFIED YET)
    const userId = generateUserId();

    console.log('🆕 Creating user with ID:', userId);

    // Save user to VIVIANA_USERS with email_verified = false
    saveUserToDatabase(userId, name, email, password, false);

    logSecurityEvent('signup_success', { email, userId });

    // Initialize user data
    localStorage.setItem(`VIVIANA_${userId}_BIO`, '');
    localStorage.setItem(`VIVIANA_${userId}_PROFILE_PIC`, '');
    localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, '[]');
    localStorage.setItem(`VIVIANA_${userId}_LAST_LOGIN`, new Date().toISOString());
    localStorage.setItem(`VIVIANA_${userId}_EMAIL_VERIFIED`, 'false');
    localStorage.setItem(`VIVIANA_${userId}_STATUS`, 'active');

    // Initialize credits with proper ledger entry (signup bonus)
    const initialCredits = 3;
    localStorage.setItem(`VIVIANA_${userId}_CREDITS`, initialCredits.toString());

    addCreditsLedgerEntry(userId, {
        type: 'initial_grant',
        amount: initialCredits,
        balance_before: 0,
        balance_after: initialCredits,
        description: 'Welcome bonus - New user signup',
        metadata: { signup_date: new Date().toISOString() }
    });

    // Store pending user info
    pendingVerificationEmail = email;
    currentUser = { userId, name, email, password, createdAt: new Date().toISOString(), emailVerified: false };

    console.log('✅ Account created - verification required');

    showToast('Account created! Please verify your email.', 'success');

    // Clear form
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';

    // Generate and send verification code
    generateVerificationCode();

    // Navigate to verification screen
    setTimeout(() => {
        showVerificationScreen();
    }, 500);
}

async function handleGoogleLogin() {
    // Check if Firebase is initialized
    if (!firebaseAuth) {
        showToast('Google Sign-In is not configured. Please set up Firebase credentials.', 'error');
        console.error('Firebase Auth not initialized. Check your Firebase configuration in script.js');
        return;
    }

    try {
        // Show loading state
        const googleButtons = document.querySelectorAll('.btn-google');
        googleButtons.forEach(btn => {
            btn.disabled = true;
            btn.innerHTML = '<span style="opacity: 0.7;">Signing in with Google...</span>';
        });

        // Create Google Auth Provider
        const provider = new firebase.auth.GoogleAuthProvider();

        // Optional: Add scopes if needed
        provider.addScope('profile');
        provider.addScope('email');

        // Sign in with popup
        const result = await firebaseAuth.signInWithPopup(provider);

        // Get user information
        const user = result.user;
        const googleEmail = user.email;
        const googleName = user.displayName;
        const googlePhotoURL = user.photoURL;
        const googleUID = user.uid;

        console.log('✅ Google Sign-In successful:', {
            email: googleEmail,
            name: googleName,
            uid: googleUID
        });

        // Check if user already exists in our system
        let existingUser = getUserByEmail(googleEmail);

        if (existingUser) {
            // User exists - log them in
            console.log('👤 Existing user found, logging in...');

            // CRITICAL: Update user data in database
            const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
            if (allUsers[existingUser.userId]) {
                // Google login auto-verifies email
                allUsers[existingUser.userId].emailVerified = true;

                // Update profile photo from Google if available
                if (googlePhotoURL && !allUsers[existingUser.userId].profilePhoto) {
                    allUsers[existingUser.userId].profilePhoto = googlePhotoURL;
                }

                // Mark as Google login method if not already set
                if (!allUsers[existingUser.userId].loginMethod) {
                    allUsers[existingUser.userId].loginMethod = 'google';
                }

                // Store Google UID if not already stored
                if (!allUsers[existingUser.userId].googleUID) {
                    allUsers[existingUser.userId].googleUID = googleUID;
                }

                localStorage.setItem('VIVIANA_USERS', JSON.stringify(allUsers));

                // Update profile pic in separate storage
                if (googlePhotoURL) {
                    localStorage.setItem(`VIVIANA_${existingUser.userId}_PROFILE_PIC`, googlePhotoURL);
                }
            }

            // Update email verified status in separate storage
            localStorage.setItem(`VIVIANA_${existingUser.userId}_EMAIL_VERIFIED`, 'true');

            // Update last login
            localStorage.setItem(`VIVIANA_${existingUser.userId}_LAST_LOGIN`, new Date().toISOString());

            // Get fresh user data with all updates
            const userData = getUserFromDatabase(existingUser.userId);
            currentUser = { userId: existingUser.userId, ...userData };

            console.log('✅ Existing user logged in with Google:', currentUser);
        } else {
            // New user - create account
            console.log('✨ New user, creating account...');

            // Generate userId using standard function
            const userId = generateUserId();

            // Save user to database using standard method (ensures consistent structure)
            saveUserToDatabase(userId, googleName || googleEmail.split('@')[0], googleEmail, null, true);

            // Add Google-specific fields to database
            const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
            if (allUsers[userId]) {
                allUsers[userId].loginMethod = 'google';
                allUsers[userId].googleUID = googleUID;
                allUsers[userId].profilePhoto = googlePhotoURL || null;
                localStorage.setItem('VIVIANA_USERS', JSON.stringify(allUsers));
            }

            // Get the user object with all fields (including Google-specific ones)
            const userData = getUserFromDatabase(userId);
            currentUser = { userId, ...userData };

            console.log('✅ New Google user created:', currentUser);

            // Initialize user data (like email signup does)
            localStorage.setItem(`VIVIANA_${userId}_BIO`, '');
            localStorage.setItem(`VIVIANA_${userId}_PROFILE_PIC`, googlePhotoURL || '');
            localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, '[]');
            localStorage.setItem(`VIVIANA_${userId}_LAST_LOGIN`, new Date().toISOString());
            localStorage.setItem(`VIVIANA_${userId}_EMAIL_VERIFIED`, 'true');
            localStorage.setItem(`VIVIANA_${userId}_STATUS`, 'active');

            // Give welcome credits (10 for Google signup)
            creditsPurchase(userId, 10, 'Free', 'google_signup_bonus');

            logSecurityEvent('user_registered', {
                userId: userId,
                email: googleEmail,
                method: 'google',
                verified: true
            });
        }

        // Save current session - CRITICAL: Must set VIVIANA_CURRENT_USER_ID for app restart
        console.log('💾 Saving session to localStorage...');
        localStorage.setItem('VIVIANA_CURRENT_USER_ID', currentUser.userId);
        localStorage.setItem('VIVIANA_CURRENT_USER', JSON.stringify(currentUser));
        console.log('✅ Session saved. User ID:', currentUser.userId);
        console.log('✅ Email verified:', currentUser.emailVerified);

        try {
            logSecurityEvent('user_login', {
                userId: currentUser.userId,
                email: googleEmail,
                method: 'google'
            });
        } catch (error) {
            console.error('❌ Error logging security event:', error);
        }

        console.log('🔄 Navigating to chat NOW...');

        // Restore Google button state (in case of success)
        const googleButtons = document.querySelectorAll('.btn-google');
        googleButtons.forEach(btn => {
            btn.disabled = false;
        });

        // Navigate to chat IMMEDIATELY (don't use setTimeout - it can fail)
        try {
            console.log('📱 Calling showChat()...');
            showChat();
            console.log('👤 Calling loadProfile()...');
            loadProfile();
            console.log('✅ Navigation complete');

            // Show welcome toast AFTER navigation
            showToast(`Welcome back, ${currentUser.name}!`, 'success');
        } catch (error) {
            console.error('❌ Error during navigation:', error);
            console.error('Error details:', error.message, error.stack);
            // Try fallback navigation
            setTimeout(() => {
                try {
                    showChat();
                    loadProfile();
                } catch (e) {
                    console.error('❌ Fallback navigation also failed:', e);
                    // Last resort - reload the page to trigger DOMContentLoaded
                    console.log('🔄 Reloading page as last resort...');
                    window.location.reload();
                }
            }, 500);
        }

    } catch (error) {
        console.error('❌ Google Sign-In error:', error);

        // Restore button state
        const googleButtons = document.querySelectorAll('.btn-google');
        googleButtons.forEach(btn => {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"/>
                    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"/>
                    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"/>
                </svg>
                Continue with Google
            `;
        });

        // Handle specific errors
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Sign-in cancelled', 'info');
        } else if (error.code === 'auth/popup-blocked') {
            showToast('Popup blocked. Please allow popups for this site.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Failed to sign in with Google. Please try again.', 'error');
        }
    }
}

// Helper function to get user by email
function getUserByEmail(email) {
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');

    for (let userId in allUsers) {
        if (allUsers[userId].email.toLowerCase() === email.toLowerCase()) {
            return { userId, ...allUsers[userId] };
        }
    }

    return null;
}

// ========================================
// EMAIL VERIFICATION
// ========================================

function generateVerificationCode() {
    // Generate 6-digit code
    verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 15 minutes from now
    verificationCodeExpiry = Date.now() + (15 * 60 * 1000);

    console.log('📧 Verification code generated:', verificationCode);
    console.log('⏰ Expires at:', new Date(verificationCodeExpiry).toLocaleTimeString());

    // In a real app, send this via email API
    // For demo, we'll log it to console
    console.log('');
    console.log('==============================================');
    console.log('📬 EMAIL VERIFICATION CODE');
    console.log('==============================================');
    console.log('To:', pendingVerificationEmail);
    console.log('Code:', verificationCode);
    console.log('Expires in: 15 minutes');
    console.log('==============================================');
    console.log('');

    // Show in alert for demo purposes
    alert(`📧 DEMO MODE: Your verification code is:\n\n${verificationCode}\n\n(In production, this would be sent via email)`);
}

function showVerificationScreen() {
    console.log('📧 Showing verification screen');
    hideAllScreens();

    const verificationScreen = document.getElementById('verificationScreen');
    verificationScreen.style.display = 'flex';
    verificationScreen.classList.add('active');

    // Set email in UI
    document.getElementById('verificationEmail').textContent = pendingVerificationEmail;

    // Setup code inputs
    setupCodeInputs();

    // Focus first input
    document.getElementById('code1').focus();
}

function setupCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');

    inputs.forEach((input, index) => {
        // Auto-focus next input
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                input.classList.add('filled');
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else {
                input.classList.remove('filled');
            }

            // Clear error state
            inputs.forEach(inp => inp.classList.remove('error'));
            document.getElementById('verificationError').style.display = 'none';
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Only allow numbers
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });

    // Setup form submission
    const form = document.getElementById('verificationForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        verifyCode();
    });
}

function verifyCode() {
    // Rate limiting
    const rateCheck = checkRateLimit('verification');
    if (!rateCheck.allowed) {
        showVerificationError(`Too many attempts. Try again in ${rateCheck.waitMinutes} minutes.`);
        logSecurityEvent('rate_limit_exceeded', { type: 'verification', email: pendingVerificationEmail });
        return;
    }

    const inputs = document.querySelectorAll('.code-input');
    const enteredCode = Array.from(inputs).map(input => input.value).join('');

    console.log('🔍 Verifying code:', enteredCode);

    // Check if code is complete
    if (enteredCode.length !== 6) {
        showVerificationError('Please enter all 6 digits');
        return;
    }

    // Check if code expired
    if (Date.now() > verificationCodeExpiry) {
        showVerificationError('Code has expired. Please request a new one.');
        inputs.forEach(input => {
            input.classList.add('error');
            input.value = '';
        });
        inputs[0].focus();
        return;
    }

    // Verify code
    if (enteredCode === verificationCode) {
        console.log('✅ Code verified successfully!');

        // Mark user as verified
        const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
        if (currentUser && users[currentUser.userId]) {
            users[currentUser.userId].emailVerified = true;
            localStorage.setItem('VIVIANA_USERS', JSON.stringify(users));
            localStorage.setItem(`VIVIANA_${currentUser.userId}_EMAIL_VERIFIED`, 'true');
        }

        currentUser.emailVerified = true;
        localStorage.setItem('VIVIANA_CURRENT_USER_ID', currentUser.userId);

        logSecurityEvent('email_verified', { email: currentUser.email, userId: currentUser.userId });
        showToast('Email verified successfully! 🎉', 'success');

        // Clear verification data
        verificationCode = null;
        verificationCodeExpiry = null;
        pendingVerificationEmail = null;

        // Navigate to chat
        setTimeout(() => {
            showChat();
        }, 1000);

    } else {
        console.log('❌ Invalid code');
        logSecurityEvent('verification_failed', { email: pendingVerificationEmail, reason: 'invalid_code' });
        showVerificationError('Invalid code. Please try again.');
        inputs.forEach(input => {
            input.classList.add('error');
            input.value = '';
        });
        inputs[0].focus();
    }
}

function showVerificationError(message) {
    const errorDiv = document.getElementById('verificationError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function resendVerificationCode() {
    // Rate limiting
    const rateCheck = checkRateLimit('verification');
    if (!rateCheck.allowed) {
        showToast(`Too many attempts. Try again in ${rateCheck.waitMinutes} minutes.`, 'error');
        logSecurityEvent('rate_limit_exceeded', { type: 'resend_verification', email: pendingVerificationEmail });
        return;
    }

    // Check cooldown
    if (resendCooldownUntil && Date.now() < resendCooldownUntil) {
        const remaining = Math.ceil((resendCooldownUntil - Date.now()) / 1000);
        showToast(`Please wait ${remaining}s before resending`, 'error');
        return;
    }

    // Generate new code
    generateVerificationCode();

    // Set cooldown (60 seconds)
    resendCooldownUntil = Date.now() + (60 * 1000);

    // Start cooldown timer
    startResendCooldown();

    showToast('New code sent!', 'success');
}

function startResendCooldown() {
    const resendBtn = document.getElementById('resendBtn');
    const timerDiv = document.getElementById('resendTimer');
    const timerSeconds = document.getElementById('timerSeconds');

    resendBtn.disabled = true;
    resendBtn.style.display = 'none';
    timerDiv.style.display = 'block';

    const interval = setInterval(() => {
        const remaining = Math.ceil((resendCooldownUntil - Date.now()) / 1000);

        if (remaining <= 0) {
            clearInterval(interval);
            resendBtn.disabled = false;
            resendBtn.style.display = 'inline-block';
            timerDiv.style.display = 'none';
        } else {
            timerSeconds.textContent = remaining;
        }
    }, 1000);
}

async function logout() {
    if (!currentUser) {
        showToast('Already logged out', 'info');
        showWelcome();
        return;
    }

    if (confirm('Are you sure you want to logout?')) {
        const userId = currentUser.userId || currentUser.id;
        const userEmail = currentUser.email;

        // Log security event
        logSecurityEvent('logout', {
            userId: userId,
            email: userEmail,
            timestamp: new Date().toISOString()
        });

        console.log('👋 Logging out user:', userId);

        // Sign out from Firebase if user logged in with Google
        if (firebaseAuth && currentUser.loginMethod === 'google') {
            try {
                await firebaseAuth.signOut();
                console.log('✅ Firebase sign-out successful');
            } catch (error) {
                console.error('❌ Firebase sign-out error:', error);
            }
        }

        // Clear session
        localStorage.removeItem('VIVIANA_CURRENT_USER_ID');
        localStorage.removeItem('VIVIANA_CURRENT_USER');

        // Clear any temporary session data (optional, but good practice)
        // Note: Keep user data, credits, messages - only clear session

        // Clear current user object
        currentUser = null;

        console.log('✅ Logout complete');
        showToast('Logged out successfully', 'success');
        setTimeout(showWelcome, 500);
    }
}

// ========================================
// CHAT
// ========================================

function loadAdminMessages() {
    if (!currentUser) return;

    const messagesData = localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`);
    if (!messagesData) return;

    const messages = JSON.parse(messagesData);
    const container = document.getElementById('chatMessages');

    // Clear existing messages (except initial greeting)
    const initialGreeting = container.querySelector('.message.received');
    container.innerHTML = '';
    if (initialGreeting) {
        container.appendChild(initialGreeting);
    }

    messages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const div = document.createElement('div');

        if (msg.sender_type === 'viviana' || msg.type === 'received') {
            // Message from Viviana
            div.className = 'message received';
            div.innerHTML = `
                <div class="message-avatar">V</div>
                <div class="message-bubble">
                    <p>${escapeHtml(msg.text)}</p>
                    <span class="message-time">${time}${msg.costsCredits === false ? ' (FREE)' : ''}</span>
                </div>
            `;
        } else if (msg.sender_type === 'user' || msg.type === 'sent') {
            // Message from User
            div.className = 'message sent';
            div.innerHTML = `
                <div class="message-bubble">
                    <p>${escapeHtml(msg.text)}</p>
                    <span class="message-time">${time}</span>
                </div>
            `;
        }

        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    // Rate limiting
    const rateCheck = checkRateLimit('message');
    if (!rateCheck.allowed) {
        showToast(`Too many messages. Try again in ${rateCheck.waitMinutes} minute(s).`, 'error');
        logSecurityEvent('rate_limit_exceeded', { type: 'message', userId: currentUser?.userId });
        return;
    }

    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text) return;

    const credits = parseInt(localStorage.getItem(`VIVIANA_${currentUser.userId}_CREDITS`) || '0');

    if (credits <= 0) {
        showToast('You need credits to send messages', 'error');
        showCreditsStore();
        return;
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'message sent';
    div.innerHTML = `
        <div class="message-bubble">
            <p>${escapeHtml(text)}</p>
            <span class="message-time">${time}</span>
        </div>
    `;

    document.getElementById('chatMessages').appendChild(div);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

    // Generate unique message ID
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Save message with NEW DATA MODEL
    const messages = JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]');
    messages.push({
        id: messageId,
        type: 'sent',
        sender_type: 'user', // NEW: Track who sent it
        text: text,
        timestamp: new Date().toISOString(),
        read: false // NEW: For unread tracking
    });
    localStorage.setItem(`VIVIANA_${currentUser.userId}_MESSAGES`, JSON.stringify(messages));

    // Deduct credit using Credits Ledger System
    const spendResult = creditsSpend(currentUser.userId, 1, 'Sent message to Viviana', { message_id: messageId });

    if (!spendResult.success) {
        console.error('❌ Failed to deduct credits:', spendResult.error);
        showToast('Failed to send message', 'error');
        return;
    }

    updateCreditsDisplay();

    input.value = '';

    // Auto-response removed - Admin will respond manually
}

function addReceivedMessage(text) {
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'message received';
    div.innerHTML = `
        <div class="message-avatar">V</div>
        <div class="message-bubble">
            <p>${escapeHtml(text)}</p>
            <span class="message-time">${time} (FREE)</span>
        </div>
    `;

    document.getElementById('chatMessages').appendChild(div);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const messages = JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]');
    messages.push({
        id: messageId,
        type: 'received',
        sender_type: 'viviana', // NEW: Message from Viviana
        text: text,
        timestamp: new Date().toISOString(),
        costsCredits: false, // NEW: Viviana messages are FREE
        read: false
    });
    localStorage.setItem(`VIVIANA_${currentUser.userId}_MESSAGES`, JSON.stringify(messages));

    // NO CREDIT DEDUCTION - Viviana messages are FREE!
    console.log('💬 Viviana message received (FREE)');
}

function updateCreditsDisplay() {
    if (!currentUser || !currentUser.userId) {
        console.error('❌ Cannot update credits: currentUser not set');
        return;
    }

    const credits = parseInt(localStorage.getItem(`VIVIANA_${currentUser.userId}_CREDITS`) || '0');
    document.getElementById('creditsCount').textContent = credits;
}

// ========================================
// PAYMENTS & WEBHOOKS
// ========================================

function initiatePayment(amount, price) {
    if (!currentUser) {
        showToast('Please log in to purchase credits', 'error');
        return;
    }

    // Generate unique payment intent ID
    const paymentIntentId = 'pi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const paymentIntent = {
        id: paymentIntentId,
        userId: currentUser.userId,
        amount: amount, // credits
        price: price, // in currency
        status: 'pending',
        created: new Date().toISOString(),
        metadata: {
            credits_amount: amount,
            user_email: currentUser.email
        }
    };

    // Store payment intent
    localStorage.setItem(`VIVIANA_PAYMENT_${paymentIntentId}`, JSON.stringify(paymentIntent));

    console.log('💳 Payment initiated:', paymentIntent);
    logSecurityEvent('payment_initiated', { paymentIntentId, amount, price, userId: currentUser.userId });

    // In production: redirect to Stripe checkout
    // For demo: simulate immediate success
    setTimeout(() => {
        processPaymentSuccess(paymentIntentId);
    }, 1000);

    showToast(`Processing payment for ${amount} credits...`, 'success');
}

function processPaymentSuccess(paymentIntentId) {
    const paymentData = localStorage.getItem(`VIVIANA_PAYMENT_${paymentIntentId}`);
    if (!paymentData) {
        console.error('❌ Payment intent not found:', paymentIntentId);
        return;
    }

    const payment = JSON.parse(paymentData);

    // Update payment status
    payment.status = 'succeeded';
    payment.completed = new Date().toISOString();
    localStorage.setItem(`VIVIANA_PAYMENT_${paymentIntentId}`, JSON.stringify(payment));

    // Add credits using Ledger System
    const newBalance = creditsPurchase(payment.userId, payment.amount, payment.price, paymentIntentId);

    console.log('✅ Payment successful:', paymentIntentId);
    console.log('New balance:', newBalance);

    logSecurityEvent('payment_succeeded', { paymentIntentId, userId: payment.userId, amount: payment.amount });

    // Trigger webhook
    triggerPaymentWebhook('payment.succeeded', payment);

    // Show success UI
    showPurchaseSuccess(payment.amount);
    updateCreditsDisplay();
}

function processPaymentFailure(paymentIntentId, reason) {
    const paymentData = localStorage.getItem(`VIVIANA_PAYMENT_${paymentIntentId}`);
    if (!paymentData) {
        console.error('❌ Payment intent not found:', paymentIntentId);
        return;
    }

    const payment = JSON.parse(paymentData);

    // Update payment status
    payment.status = 'failed';
    payment.failed = new Date().toISOString();
    payment.failure_reason = reason;
    localStorage.setItem(`VIVIANA_PAYMENT_${paymentIntentId}`, JSON.stringify(payment));

    console.log('❌ Payment failed:', paymentIntentId, reason);
    logSecurityEvent('payment_failed', { paymentIntentId, userId: payment.userId, reason });

    // Trigger webhook
    triggerPaymentWebhook('payment.failed', payment);

    showToast(`Payment failed: ${reason}`, 'error');
}

function triggerPaymentWebhook(eventType, paymentData) {
    const webhookEvent = {
        id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        type: eventType,
        created: new Date().toISOString(),
        data: {
            object: paymentData
        }
    };

    // Store webhook event for audit
    const webhookLog = JSON.parse(localStorage.getItem('VIVIANA_WEBHOOK_LOG') || '[]');
    webhookLog.push(webhookEvent);

    // Keep last 100 events
    if (webhookLog.length > 100) webhookLog.shift();

    localStorage.setItem('VIVIANA_WEBHOOK_LOG', JSON.stringify(webhookLog));

    console.log('🔔 Webhook triggered:', eventType, webhookEvent);

    // In production: send HTTP POST to registered webhook URLs
    // PAYMENT_WEBHOOKS.forEach(url => fetch(url, { method: 'POST', body: JSON.stringify(webhookEvent) }));
}

function processRefund(paymentIntentId, reason) {
    const paymentData = localStorage.getItem(`VIVIANA_PAYMENT_${paymentIntentId}`);
    if (!paymentData) {
        console.error('❌ Payment not found for refund:', paymentIntentId);
        return { success: false, error: 'Payment not found' };
    }

    const payment = JSON.parse(paymentData);

    if (payment.status !== 'succeeded') {
        return { success: false, error: 'Can only refund successful payments' };
    }

    // Mark payment as refunded
    payment.status = 'refunded';
    payment.refunded = new Date().toISOString();
    payment.refund_reason = reason;
    localStorage.setItem(`VIVIANA_PAYMENT_${paymentIntentId}`, JSON.stringify(payment));

    // Refund credits
    const newBalance = creditsRefund(payment.userId, payment.amount, reason, paymentIntentId);

    console.log('💸 Refund processed:', paymentIntentId);
    logSecurityEvent('payment_refunded', { paymentIntentId, userId: payment.userId, amount: payment.amount, reason });

    // Trigger webhook
    triggerPaymentWebhook('payment.refunded', payment);

    return { success: true, balance: newBalance };
}

// ========================================
// CREDITS
// ========================================

function purchaseCredits(amount, price) {
    // Use new payment flow
    initiatePayment(amount, price);
}

function showPurchaseSuccess(amount) {
    const popup = document.getElementById('purchaseSuccessPopup');
    popup.querySelector('p').innerHTML = `You've successfully purchased<br><strong>${amount} credits</strong>! 🎉`;
    popup.classList.add('active');
    createConfetti();
    setTimeout(() => popup.classList.remove('active'), 3000);
}

function createConfetti() {
    const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#4CAF50', '#FFEB3B'];
    const container = document.querySelector('.confetti');
    container.innerHTML = '';

    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.style.cssText = `
            position: absolute;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}%;
            animation: confetti-fall ${2 + Math.random() * 2}s linear forwards;
            animation-delay: ${Math.random() * 0.5}s;
            opacity: 0;
        `;
        container.appendChild(c);
    }
}

// ========================================
// PROFILE
// ========================================

function loadProfile() {
    if (!currentUser) return;

    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profileEmail').value = currentUser.email;

    const bio = localStorage.getItem(`VIVIANA_${currentUser.userId}_BIO`) || '';
    document.getElementById('profileBio').value = bio;

    const pic = localStorage.getItem(`VIVIANA_${currentUser.userId}_PROFILE_PIC`);
    if (pic) {
        document.getElementById('profilePicture').src = pic;
    } else {
        const initial = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('profilePicture').src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-size="60" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E${initial}%3C/text%3E%3C/svg%3E`;
    }
}

function handleProfileUpdate(e) {
    e.preventDefault();

    const name = document.getElementById('profileName').value.trim();
    const bio = document.getElementById('profileBio').value.trim();

    if (!name) {
        showToast('Name cannot be empty', 'error');
        return;
    }

    // Update in VIVIANA_USERS
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    if (allUsers[currentUser.userId]) {
        allUsers[currentUser.userId].name = name;
        localStorage.setItem('VIVIANA_USERS', JSON.stringify(allUsers));
    }

    localStorage.setItem(`VIVIANA_${currentUser.userId}_BIO`, bio);

    currentUser.name = name;

    showToast('Profile updated successfully!', 'success');
}

function uploadProfilePicture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/jpg, image/gif';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('Image too large. Max 5MB allowed.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            localStorage.setItem(`VIVIANA_${currentUser.userId}_PROFILE_PIC`, base64);
            document.getElementById('profilePicture').src = base64;
            showToast('Profile picture updated!', 'success');
        };
        reader.onerror = () => showToast('Failed to upload image', 'error');
        reader.readAsDataURL(file);
    };

    input.click();
}

function deleteAccount() {
    document.getElementById('deleteAccountModal').classList.add('active');
}

function closeDeleteConfirm() {
    document.getElementById('deleteAccountModal').classList.remove('active');
}

function confirmDeleteAccount() {
    if (!currentUser) return;

    const userId = currentUser.userId;
    const userEmail = currentUser.email;

    console.log('🗑️ Deleting account:', userId);

    // Log security event BEFORE deletion
    logSecurityEvent('account_deleted', {
        userId: userId,
        email: userEmail,
        timestamp: new Date().toISOString()
    });

    // Soft-delete: Mark user as deleted in VIVIANA_USERS
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    if (allUsers[userId]) {
        allUsers[userId].status = 'deleted';
        allUsers[userId].deletedAt = new Date().toISOString();
        allUsers[userId].email = `deleted_${userId}@deleted.local`; // Anonymize email to allow re-registration
        allUsers[userId].password = null; // Remove password hash
        allUsers[userId].name = 'Deleted User';
        localStorage.setItem('VIVIANA_USERS', JSON.stringify(allUsers));
    }

    // Remove all user-specific data
    localStorage.removeItem(`VIVIANA_${userId}_CREDITS`);
    localStorage.removeItem(`VIVIANA_${userId}_CREDITS_LEDGER`);
    localStorage.removeItem(`VIVIANA_${userId}_BIO`);
    localStorage.removeItem(`VIVIANA_${userId}_PROFILE_PIC`);
    localStorage.removeItem(`VIVIANA_${userId}_MESSAGES`);
    localStorage.removeItem(`VIVIANA_${userId}_LAST_LOGIN`);
    localStorage.removeItem(`VIVIANA_${userId}_EMAIL_VERIFIED`);
    localStorage.removeItem(`VIVIANA_${userId}_STATUS`);
    localStorage.removeItem(`VIVIANA_${userId}_NOTIFICATION_SETTINGS`);
    localStorage.removeItem(`VIVIANA_${userId}_PRIVACY_SETTINGS`);

    // Remove session
    localStorage.removeItem('VIVIANA_CURRENT_USER_ID');

    // Clear current user
    currentUser = null;

    console.log('✅ Account deletion complete');
    showToast('Account deleted successfully', 'success');
    closeDeleteConfirm();
    setTimeout(showWelcome, 1000);
}

// ========================================
// NOTIFICATION SETTINGS
// ========================================

function showNotificationSettings() {
    if (!currentUser) {
        showToast('Please login first', 'error');
        return;
    }

    console.log('🔔 Showing notification settings');
    hideAllScreens();

    const screen = document.getElementById('notificationSettingsScreen');
    screen.style.display = 'flex';
    screen.classList.add('active');

    // Load current settings
    loadNotificationSettings();
}

function loadNotificationSettings() {
    if (!currentUser) return;

    // Get settings from localStorage or use defaults
    const settingsKey = `VIVIANA_${currentUser.userId}_NOTIFICATION_SETTINGS`;
    const savedSettings = localStorage.getItem(settingsKey);

    let settings;
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    } else {
        // Default settings
        settings = {
            newMessages: true,
            credits: true,
            email: true,
            productUpdates: false
        };
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    }

    // Apply to UI
    document.getElementById('notifyNewMessages').checked = settings.newMessages;
    document.getElementById('notifyCredits').checked = settings.credits;
    document.getElementById('notifyEmail').checked = settings.email;
    document.getElementById('notifyProductUpdates').checked = settings.productUpdates;

    console.log('🔔 Loaded notification settings:', settings);
}

function saveNotificationSettings() {
    if (!currentUser) return;

    const settings = {
        newMessages: document.getElementById('notifyNewMessages').checked,
        credits: document.getElementById('notifyCredits').checked,
        email: document.getElementById('notifyEmail').checked,
        productUpdates: document.getElementById('notifyProductUpdates').checked
    };

    const settingsKey = `VIVIANA_${currentUser.userId}_NOTIFICATION_SETTINGS`;
    localStorage.setItem(settingsKey, JSON.stringify(settings));

    // Log security event
    logSecurityEvent('settings_updated', {
        type: 'notifications',
        userId: currentUser.userId,
        settings: settings
    });

    console.log('💾 Saved notification settings:', settings);
    showToast('Notification settings saved', 'success');
}

// ========================================
// PRIVACY SETTINGS
// ========================================

function showPrivacySettings() {
    if (!currentUser) {
        showToast('Please login first', 'error');
        return;
    }

    console.log('🔒 Showing privacy settings');
    hideAllScreens();

    const screen = document.getElementById('privacySettingsScreen');
    screen.style.display = 'flex';
    screen.classList.add('active');

    // Load current settings
    loadPrivacySettings();
}

function loadPrivacySettings() {
    if (!currentUser) return;

    // Get settings from localStorage or use defaults
    const settingsKey = `VIVIANA_${currentUser.userId}_PRIVACY_SETTINGS`;
    const savedSettings = localStorage.getItem(settingsKey);

    let settings;
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    } else {
        // Default settings
        settings = {
            profileVisibility: 'private',
            allowAnalytics: false,
            showVerifiedBadge: true
        };
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    }

    // Apply to UI - Profile Visibility Radio Buttons
    const radioButtons = document.querySelectorAll('input[name="profileVisibility"]');
    radioButtons.forEach(radio => {
        radio.checked = (radio.value === settings.profileVisibility);
    });

    // Apply to UI - Toggles
    document.getElementById('allowAnalytics').checked = settings.allowAnalytics;
    document.getElementById('showVerifiedBadge').checked = settings.showVerifiedBadge;

    console.log('🔒 Loaded privacy settings:', settings);
}

function savePrivacySettings() {
    if (!currentUser) return;

    // Get selected profile visibility
    const selectedVisibility = document.querySelector('input[name="profileVisibility"]:checked');

    const settings = {
        profileVisibility: selectedVisibility ? selectedVisibility.value : 'private',
        allowAnalytics: document.getElementById('allowAnalytics').checked,
        showVerifiedBadge: document.getElementById('showVerifiedBadge').checked
    };

    const settingsKey = `VIVIANA_${currentUser.userId}_PRIVACY_SETTINGS`;
    localStorage.setItem(settingsKey, JSON.stringify(settings));

    // Log security event
    logSecurityEvent('settings_updated', {
        type: 'privacy',
        userId: currentUser.userId,
        settings: settings
    });

    console.log('💾 Saved privacy settings:', settings);
    showToast('Privacy settings saved', 'success');
}

// ========================================
// VERIFICATION
// ========================================

function showVerificationPopup() {
    document.getElementById('verificationPopup').classList.add('active');
}

function closeVerificationPopup() {
    document.getElementById('verificationPopup').classList.remove('active');
}

function handleVerificationUpload() {
    showToast('Verification is not available in demo mode', 'error');
    setTimeout(closeVerificationPopup, 2000);
}

// ========================================
// PASSWORD RESET
// ========================================

function showPasswordResetScreen() {
    console.log('📧 Showing password reset screen');
    hideAllScreens();

    const resetScreen = document.getElementById('passwordResetScreen');
    resetScreen.style.display = 'flex';
    resetScreen.classList.add('active');

    // Clear form
    document.getElementById('resetEmail').value = '';
}

function handlePasswordResetRequest(e) {
    e.preventDefault();

    // Rate limiting
    const rateCheck = checkRateLimit('verification'); // Reuse verification rate limit
    if (!rateCheck.allowed) {
        showToast(`Too many attempts. Try again in ${rateCheck.waitMinutes} minutes.`, 'error');
        logSecurityEvent('rate_limit_exceeded', { type: 'password_reset' });
        return;
    }

    const email = document.getElementById('resetEmail').value.trim().toLowerCase();

    if (!email) {
        showToast('Please enter your email', 'error');
        return;
    }

    // Check if user exists
    const user = findUserByEmail(email);
    if (!user) {
        // Security: Don't reveal if email exists
        showToast('If this email exists, you will receive a reset code', 'success');
        logSecurityEvent('password_reset_attempted', { email, found: false });
        return;
    }

    // Generate reset code
    passwordResetEmail = email;
    passwordResetCode = Math.floor(100000 + Math.random() * 900000).toString();
    passwordResetCodeExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes

    console.log('🔐 Password reset code generated:', passwordResetCode);
    console.log('⏰ Expires at:', new Date(passwordResetCodeExpiry).toLocaleTimeString());

    // In production: send via email API
    console.log('');
    console.log('==============================================');
    console.log('📬 PASSWORD RESET CODE');
    console.log('==============================================');
    console.log('To:', passwordResetEmail);
    console.log('Code:', passwordResetCode);
    console.log('Expires in: 15 minutes');
    console.log('==============================================');
    console.log('');

    alert(`📧 DEMO MODE: Your password reset code is:\n\n${passwordResetCode}\n\n(In production, this would be sent via email)`);

    logSecurityEvent('password_reset_requested', { email });
    showToast('Reset code sent to your email', 'success');

    // Navigate to verification screen
    setTimeout(() => {
        showPasswordResetVerifyScreen();
    }, 500);
}

function showPasswordResetVerifyScreen() {
    console.log('🔐 Showing password reset verify screen');
    hideAllScreens();

    const verifyScreen = document.getElementById('passwordResetVerifyScreen');
    verifyScreen.style.display = 'flex';
    verifyScreen.classList.add('active');

    // Set email in UI
    document.getElementById('resetEmailDisplay').textContent = passwordResetEmail;

    // Setup code inputs
    setupResetCodeInputs();

    // Focus first input
    document.getElementById('resetCode1').focus();

    // Clear password fields
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

function setupResetCodeInputs() {
    const inputs = document.querySelectorAll('.reset-code-input');

    inputs.forEach((input, index) => {
        // Auto-focus next input
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                input.classList.add('filled');
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else {
                input.classList.remove('filled');
            }

            // Clear error state
            inputs.forEach(inp => inp.classList.remove('error'));
            document.getElementById('resetCodeError').style.display = 'none';
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Only allow numbers
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });
}

function handlePasswordResetVerify(e) {
    e.preventDefault();

    // Rate limiting
    const rateCheck = checkRateLimit('verification');
    if (!rateCheck.allowed) {
        showResetCodeError(`Too many attempts. Try again in ${rateCheck.waitMinutes} minutes.`);
        logSecurityEvent('rate_limit_exceeded', { type: 'password_reset_verify' });
        return;
    }

    const inputs = document.querySelectorAll('.reset-code-input');
    const enteredCode = Array.from(inputs).map(input => input.value).join('');

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate code
    if (enteredCode.length !== 6) {
        showResetCodeError('Please enter all 6 digits');
        return;
    }

    // Check if code expired
    if (Date.now() > passwordResetCodeExpiry) {
        showResetCodeError('Code has expired. Please request a new one.');
        inputs.forEach(input => {
            input.classList.add('error');
            input.value = '';
        });
        inputs[0].focus();
        logSecurityEvent('password_reset_failed', { email: passwordResetEmail, reason: 'code_expired' });
        return;
    }

    // Verify code
    if (enteredCode !== passwordResetCode) {
        showResetCodeError('Invalid code. Please try again.');
        inputs.forEach(input => {
            input.classList.add('error');
            input.value = '';
        });
        inputs[0].focus();
        logSecurityEvent('password_reset_failed', { email: passwordResetEmail, reason: 'invalid_code' });
        return;
    }

    // Validate password
    if (newPassword.length < 6) {
        showResetCodeError('Password must be at least 6 characters');
        return;
    }

    if (newPassword !== confirmPassword) {
        showResetCodeError('Passwords do not match');
        return;
    }

    // Find user and update password
    const user = findUserByEmail(passwordResetEmail);
    if (!user) {
        showToast('User not found', 'error');
        return;
    }

    // Update password in database
    const allUsers = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    if (allUsers[user.userId]) {
        allUsers[user.userId].password = newPassword;
        localStorage.setItem('VIVIANA_USERS', JSON.stringify(allUsers));
    }

    console.log('✅ Password reset successful for:', passwordResetEmail);
    logSecurityEvent('password_reset_success', { email: passwordResetEmail, userId: user.userId });

    showToast('Password reset successfully! 🎉', 'success');

    // Clear reset data
    passwordResetCode = null;
    passwordResetCodeExpiry = null;
    passwordResetEmail = null;

    // Navigate to login
    setTimeout(() => {
        showAuth();
        switchToLogin();
    }, 1500);
}

function showResetCodeError(message) {
    const errorDiv = document.getElementById('resetCodeError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function resendPasswordResetCode() {
    // Rate limiting
    const rateCheck = checkRateLimit('verification');
    if (!rateCheck.allowed) {
        showToast(`Too many attempts. Try again in ${rateCheck.waitMinutes} minutes.`, 'error');
        logSecurityEvent('rate_limit_exceeded', { type: 'resend_password_reset' });
        return;
    }

    // Check cooldown
    if (passwordResetCooldownUntil && Date.now() < passwordResetCooldownUntil) {
        const remaining = Math.ceil((passwordResetCooldownUntil - Date.now()) / 1000);
        showToast(`Please wait ${remaining}s before resending`, 'error');
        return;
    }

    // Generate new code
    passwordResetCode = Math.floor(100000 + Math.random() * 900000).toString();
    passwordResetCodeExpiry = Date.now() + (15 * 60 * 1000);

    console.log('🔐 New password reset code:', passwordResetCode);
    alert(`📧 DEMO MODE: Your new password reset code is:\n\n${passwordResetCode}\n\n(In production, this would be sent via email)`);

    // Set cooldown (60 seconds)
    passwordResetCooldownUntil = Date.now() + (60 * 1000);

    // Start cooldown timer
    startPasswordResetCooldown();

    logSecurityEvent('password_reset_code_resent', { email: passwordResetEmail });
    showToast('New reset code sent!', 'success');
}

function startPasswordResetCooldown() {
    const resendBtn = document.getElementById('resendResetBtn');
    const timerDiv = document.getElementById('resendResetTimer');
    const timerSeconds = document.getElementById('resetTimerSeconds');

    resendBtn.disabled = true;
    resendBtn.style.display = 'none';
    timerDiv.style.display = 'block';

    const interval = setInterval(() => {
        const remaining = Math.ceil((passwordResetCooldownUntil - Date.now()) / 1000);

        if (remaining <= 0) {
            clearInterval(interval);
            resendBtn.disabled = false;
            resendBtn.style.display = 'inline-block';
            timerDiv.style.display = 'none';
        } else {
            timerSeconds.textContent = remaining;
        }
    }, 1000);
}

// ========================================
// UTILITY
// ========================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
