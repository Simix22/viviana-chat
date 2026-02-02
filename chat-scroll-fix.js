/* ============================================
   CHAT SCROLL FIX - JITTER ELIMINATION
   Stable, append-only message rendering
   ============================================ */

// Track rendered messages to prevent duplicates
let renderedMessageIds = new Set();
let isScrollingProgrammatically = false;
let isChatInitialized = false; // Track if chat has been initialized
let lastUserId = null; // Track last user to detect user switches

// Centralized scroll manager - smooth and stable
function scrollChatToBottom(force = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // Check if user is near bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    // Only auto-scroll if user is near bottom OR it's forced (user sent message)
    if (force || isNearBottom) {
        // Prevent multiple scroll operations
        if (isScrollingProgrammatically) return;

        isScrollingProgrammatically = true;

        // Use requestAnimationFrame for smooth, single-frame scroll
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;

            // Reset flag after scroll completes
            setTimeout(() => {
                isScrollingProgrammatically = false;
            }, 50);
        });
    }
}

// Append-only message rendering - NO innerHTML clearing!
function appendMessageToChat(message, isNewMessage = false) {
    // Deduplication check
    if (renderedMessageIds.has(message.id)) {
        console.log('⏭️ Message already rendered, skipping:', message.id);
        return;
    }

    const container = document.getElementById('chatMessages');
    if (!container) return;

    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    const div = document.createElement('div');
    div.dataset.messageId = message.id; // Track in DOM

    if (message.sender_type === 'viviana' || message.type === 'received') {
        // Message from Viviana
        div.className = 'message received';
        if (isNewMessage) div.classList.add('new-message');
        div.innerHTML = `
            <div class="message-avatar">V</div>
            <div class="message-bubble">
                <p>${escapeHtml(message.text)}</p>
                <span class="message-time">${time}${message.costsCredits === false ? ' (FREE)' : ''}</span>
            </div>
        `;
    } else if (message.sender_type === 'user' || message.type === 'sent') {
        // Message from User
        div.className = 'message sent';
        if (isNewMessage) div.classList.add('new-message');
        div.innerHTML = `
            <div class="message-bubble">
                <p>${escapeHtml(message.text)}</p>
                <span class="message-time">${time}</span>
            </div>
        `;
    }

    // Append to DOM (stable, no re-render)
    container.appendChild(div);

    // Track as rendered
    renderedMessageIds.add(message.id);

    console.log('✅ Message appended:', message.id);
}

// Load messages ONCE at init - then only append new ones
function loadMessagesStable() {
    if (!currentUser) return;

    const messagesData = localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`);
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // DETECT USER SWITCH - Reset chat state if user changed
    if (lastUserId !== null && lastUserId !== currentUser.userId) {
        console.log('🔄 User switched, resetting chat state');
        resetChatState();
    }

    // Update last user ID
    lastUserId = currentUser.userId;

    // FIRST TIME INITIALIZATION
    if (!isChatInitialized) {
        console.log('🎬 First-time chat initialization');

        // Clear rendered tracking
        renderedMessageIds.clear();

        // Add loading class to disable animations during batch load
        container.classList.add('loading');

        // Keep initial greeting if exists
        const initialGreeting = container.querySelector('.message.received:first-child');
        const hasGreeting = !!initialGreeting;

        // Clear DOM ONLY on FIRST initialization
        container.innerHTML = '';

        // Re-add greeting
        if (hasGreeting && initialGreeting) {
            container.appendChild(initialGreeting);
            // Track greeting to prevent duplication
            renderedMessageIds.add('initial-greeting');
        }

        // Load all messages if available
        if (messagesData) {
            const messages = JSON.parse(messagesData);
            console.log(`📨 Loading ${messages.length} messages (initial load)`);

            // Append all messages (no animation during batch load)
            messages.forEach(message => {
                appendMessageToChat(message, false); // isNewMessage = false for batch
            });
        }

        // Remove loading class after batch is done
        setTimeout(() => {
            container.classList.remove('loading');
        }, 100);

        // Mark as initialized
        isChatInitialized = true;

        // Scroll to bottom (force on initial load)
        scrollChatToBottom(true);

        console.log('✅ Chat initialized successfully');
    }
    // SUBSEQUENT CALLS - APPEND ONLY NEW MESSAGES
    else {
        console.log('🔄 Syncing messages (append-only mode)');

        if (!messagesData) return;

        const messages = JSON.parse(messagesData);
        let newMessagesAdded = 0;

        // Only append messages that aren't rendered yet
        messages.forEach(message => {
            if (!renderedMessageIds.has(message.id)) {
                appendMessageToChat(message, false); // No animation for sync
                newMessagesAdded++;
            }
        });

        if (newMessagesAdded > 0) {
            console.log(`📥 Appended ${newMessagesAdded} new message(s)`);
            // Auto-scroll if user is near bottom
            scrollChatToBottom(false);
        } else {
            console.log('✓ No new messages to append');
        }
    }
}

// Sync new messages from storage - APPEND ONLY!
function syncNewMessages() {
    if (!currentUser) return;

    const messagesData = localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`);
    if (!messagesData) return;

    const messages = JSON.parse(messagesData);
    let newMessagesAdded = 0;

    // Only append messages that aren't rendered yet
    messages.forEach(message => {
        if (!renderedMessageIds.has(message.id)) {
            appendMessageToChat(message, true); // isNewMessage = true for sync
            newMessagesAdded++;
        }
    });

    if (newMessagesAdded > 0) {
        console.log(`📥 Synced ${newMessagesAdded} new message(s)`);
        // Auto-scroll if user is near bottom
        scrollChatToBottom(false);
    }
}

// Enhanced sendMessage - uses stable append system
function sendMessageStable() {
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

    // Generate unique message ID
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const message = {
        id: messageId,
        type: 'sent',
        sender_type: 'user',
        text: text,
        timestamp: new Date().toISOString(),
        read: false
    };

    // Append to chat immediately with animation (no wait)
    appendMessageToChat(message, true); // isNewMessage = true

    // Force scroll to bottom (user sent message)
    scrollChatToBottom(true);

    // Save to localStorage
    const messages = JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]');
    messages.push(message);
    localStorage.setItem(`VIVIANA_${currentUser.userId}_MESSAGES`, JSON.stringify(messages));

    // Deduct credit
    const newCredits = credits - 1;
    localStorage.setItem(`VIVIANA_${currentUser.userId}_CREDITS`, newCredits);
    updateCreditsDisplay();

    // Clear input
    input.value = '';

    console.log('✅ Message sent:', messageId);
}

// Enhanced addReceivedMessage - uses stable append system
function addReceivedMessageStable(text, isFree = true) {
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const message = {
        id: messageId,
        type: 'received',
        sender_type: 'viviana',
        text: text,
        timestamp: new Date().toISOString(),
        costsCredits: !isFree,
        read: false
    };

    // Append to chat immediately with animation
    appendMessageToChat(message, true); // isNewMessage = true

    // Auto-scroll (new message from Viviana)
    scrollChatToBottom(false);

    // Save to localStorage
    const messages = JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]');
    messages.push(message);
    localStorage.setItem(`VIVIANA_${currentUser.userId}_MESSAGES`, JSON.stringify(messages));

    console.log('✅ Received message:', messageId);
}

// Replace the old 3-second rebuild with intelligent sync
function startMessageSyncStable() {
    // Stop old refresh if exists
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
    }

    // Sync new messages every 3 seconds (append-only, no rebuild!)
    messageRefreshInterval = setInterval(() => {
        if (currentUser && document.getElementById('chatScreen').classList.contains('active')) {
            syncNewMessages();
        }
    }, 3000);

    console.log('✅ Stable message sync started');
}

function stopMessageSyncStable() {
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
        messageRefreshInterval = null;
    }
    console.log('🛑 Message sync stopped');
}

// Reset chat state (call on logout, user switch, or screen change)
function resetChatState() {
    console.log('🔄 Resetting chat state');
    isChatInitialized = false;
    renderedMessageIds.clear();
    isScrollingProgrammatically = false;
    stopMessageSyncStable();
}

// Expose resetChatState globally for logout/login flows
window.resetChatState = resetChatState;

// Override original functions
console.log('🔧 Applying chat scroll jitter fix...');

// Store original functions as backup
if (typeof sendMessage !== 'undefined') {
    window._originalSendMessage = sendMessage;
    window.sendMessage = sendMessageStable;
}

if (typeof addReceivedMessage !== 'undefined') {
    window._originalAddReceivedMessage = addReceivedMessage;
    window.addReceivedMessage = addReceivedMessageStable;
}

if (typeof loadAdminMessages !== 'undefined') {
    window._originalLoadAdminMessages = loadAdminMessages;
    window.loadAdminMessages = loadMessagesStable;
}

if (typeof startMessageRefresh !== 'undefined') {
    window._originalStartMessageRefresh = startMessageRefresh;
    window.startMessageRefresh = startMessageSyncStable;
}

if (typeof stopMessageRefresh !== 'undefined') {
    window._originalStopMessageRefresh = stopMessageRefresh;
    window.stopMessageRefresh = stopMessageSyncStable;
}

console.log('✅ Chat scroll jitter fix applied! All functions overridden.');
