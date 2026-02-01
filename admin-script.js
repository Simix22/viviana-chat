// Admin Panel - Viviana
// Credits-based monetization system with comprehensive admin features

console.log('Admin script loaded');

// Global state
let currentUser = null;
let allUsers = [];
let currentSection = 'dashboard';
let analyticsRange = 'all';

// ============================================
// INITIALIZATION & LOGIN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    initializeAdmin();
});

function initializeAdmin() {
    const loginForm = document.getElementById('adminLoginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;

            if (username === 'admin' && password === 'admin123') {
                console.log('✅ Admin login successful');

                // CRITICAL: Properly hide login screen
                const loginScreen = document.getElementById('adminLoginScreen');
                loginScreen.classList.remove('active');
                loginScreen.style.display = 'none';

                // CRITICAL: Properly show dashboard
                const dashboard = document.getElementById('adminDashboard');
                dashboard.style.display = 'flex';
                dashboard.classList.add('active');

                // Load data
                loadAllData();

                console.log('✅ Dashboard is now visible');
            } else {
                showToast('Invalid credentials! Use admin / admin123', 'error');
            }
        });
    }

    // Enter key support for admin chat
    const chatInput = document.getElementById('adminMessageInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendAdminMessage();
            }
        });
    }

    // Initialize system settings
    initializeSystemSettings();
}

// ============================================
// CREDITS LEDGER SYSTEM
// ============================================

function getCreditsLedger(userId) {
    // Use same key format as script.js for consistency
    const ledgerKey = `VIVIANA_${userId}_CREDITS_LEDGER`;
    const ledgerData = localStorage.getItem(ledgerKey);
    return ledgerData ? JSON.parse(ledgerData) : [];
}

function addLedgerEntry(userId, type, amount, reason, referenceId = null) {
    const ledger = getCreditsLedger(userId);
    const balanceBefore = getCurrentCredits(userId);
    const balanceAfter = balanceBefore + amount;

    const entry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        event_type: type, // 'purchase', 'spend', 'admin_adjust', 'refund', 'initial_grant'
        amount: amount, // positive for add, negative for subtract
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        metadata: referenceId ? { reference_id: referenceId } : {}
    };

    ledger.push(entry);
    localStorage.setItem(`VIVIANA_${userId}_CREDITS_LEDGER`, JSON.stringify(ledger));

    // Update user credits
    localStorage.setItem(`VIVIANA_${userId}_CREDITS`, balanceAfter.toString());

    // Log activity
    logActivity('credits', `Credits ${amount > 0 ? 'added' : 'deducted'} for user ${userId}: ${Math.abs(amount)} credits (${reason})`);

    return entry;
}

function getCurrentCredits(userId) {
    const credits = localStorage.getItem(`VIVIANA_${userId}_CREDITS`);
    return credits ? parseInt(credits) : 0;
}

function getTotalPurchased(userId) {
    const ledger = getCreditsLedger(userId);
    return ledger
        .filter(entry => entry.event_type === 'purchase' || entry.event_type === 'initial_grant')
        .reduce((sum, entry) => sum + entry.amount, 0);
}

function getTotalConsumed(userId) {
    const ledger = getCreditsLedger(userId);
    return Math.abs(ledger
        .filter(entry => entry.event_type === 'spend')
        .reduce((sum, entry) => sum + entry.amount, 0));
}

// ============================================
// USER MANAGEMENT
// ============================================

function getUserData(userId) {
    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    return users[userId];
}

function getUserStatus(userId) {
    const status = localStorage.getItem(`VIVIANA_${userId}_STATUS`);
    return status || 'active';
}

function setUserStatus(userId, status) {
    localStorage.setItem(`VIVIANA_${userId}_STATUS`, status);
    logActivity('users', `User ${userId} status changed to ${status}`);
}

function getLastLogin(userId) {
    const lastLogin = localStorage.getItem(`VIVIANA_${userId}_LAST_LOGIN`);
    return lastLogin ? new Date(lastLogin) : null;
}

function loadUsersData() {
    console.log('📊 ADMIN: Loading users data...');
    console.log('📦 Environment: Browser localStorage');
    console.log('🗄️ Source: VIVIANA_USERS');

    const usersData = localStorage.getItem('VIVIANA_USERS');

    if (!usersData || usersData === '{}') {
        console.log('❌ ADMIN: No users found in VIVIANA_USERS');
        console.log('📊 Total localStorage keys:', localStorage.length);

        // List all VIVIANA_* keys for debugging
        let vivianaKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('VIVIANA_')) {
                vivianaKeys.push(key);
            }
        }
        console.log('🔑 Found VIVIANA_* keys:', vivianaKeys.length, vivianaKeys);

        document.getElementById('usersTableBody').innerHTML =
            '<tr><td colspan="9" class="no-data">No users found</td></tr>';
        return;
    }

    const users = JSON.parse(usersData);
    const userIds = Object.keys(users);

    console.log('✅ ADMIN: Found users in database:', userIds.length);
    console.log('📧 User emails:', userIds.map(id => users[id].email));

    allUsers = userIds.map(userId => ({
        id: userId,
        ...users[userId],
        status: getUserStatus(userId),
        currentCredits: getCurrentCredits(userId),
        totalPurchased: getTotalPurchased(userId),
        totalConsumed: getTotalConsumed(userId),
        lastLogin: getLastLogin(userId)
    }));

    console.log('👥 ADMIN: Loaded user objects:', allUsers.length);
    console.log('📊 Status breakdown:', {
        active: allUsers.filter(u => u.status === 'active').length,
        deleted: allUsers.filter(u => u.status === 'deleted').length,
        blocked: allUsers.filter(u => u.status === 'blocked').length
    });

    renderUsersTable(allUsers);

    // Update debug info if visible
    const debugResult = document.getElementById('debugSearchResult');
    if (debugResult) {
        debugResult.innerHTML = `
            <div style="background: #d1ecf1; padding: 10px; border-radius: 6px; border-left: 4px solid #17a2b8;">
                <strong style="color: #0c5460;">ℹ️ Database Status</strong><br>
                <span style="color: #0c5460; font-size: 13px;">
                    Total users loaded: <strong>${allUsers.length}</strong><br>
                    Active: ${allUsers.filter(u => u.status === 'active').length} |
                    Deleted: ${allUsers.filter(u => u.status === 'deleted').length} |
                    Blocked: ${allUsers.filter(u => u.status === 'blocked').length}
                </span>
            </div>
        `;
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const statusClass = user.status === 'active' ? 'status-active' :
                           user.status === 'blocked' ? 'status-blocked' : 'status-deleted';
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never';
        const signupDate = new Date(user.createdAt).toLocaleDateString();

        return `
            <tr>
                <td><code>${user.id.substring(0, 8)}...</code></td>
                <td>${user.email}</td>
                <td>${signupDate}</td>
                <td>${lastLogin}</td>
                <td><span class="status-badge ${statusClass}">${user.status}</span></td>
                <td><strong>${user.currentCredits}</strong></td>
                <td>${user.totalPurchased}</td>
                <td>${user.totalConsumed}</td>
                <td class="actions">
                    <button class="btn-icon" onclick="viewUserDetails('${user.id}')" title="View Details">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="chatWithUser('${user.id}')" title="Chat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const creditsFilter = document.getElementById('creditsFilter').value;

    let filtered = allUsers;

    if (searchTerm) {
        filtered = filtered.filter(u => u.email.toLowerCase().includes(searchTerm));
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(u => u.status === statusFilter);
    }

    if (creditsFilter === 'low') {
        filtered = filtered.filter(u => u.currentCredits < 10);
    } else if (creditsFilter === 'high') {
        filtered = filtered.filter(u => u.totalPurchased > 100);
    }

    renderUsersTable(filtered);
}

function viewUserDetails(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    currentUser = userId;

    document.getElementById('detailUserId').textContent = userId.substring(0, 16) + '...';
    document.getElementById('detailEmail').textContent = user.email;
    document.getElementById('detailStatus').innerHTML =
        `<span class="status-badge status-${user.status}">${user.status}</span>`;
    document.getElementById('detailCredits').textContent = user.currentCredits;
    document.getElementById('detailPurchased').textContent = user.totalPurchased;
    document.getElementById('detailConsumed').textContent = user.totalConsumed;
    document.getElementById('detailSignup').textContent = new Date(user.createdAt).toLocaleString();
    document.getElementById('detailLastLogin').textContent =
        user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';

    document.getElementById('userDetailsModal').classList.add('active');
}

function closeUserDetails() {
    document.getElementById('userDetailsModal').classList.remove('active');
    currentUser = null;
}

function adjustCreditsModal() {
    if (!currentUser) return;

    const user = allUsers.find(u => u.id === currentUser);
    document.getElementById('adjustCreditsUserEmail').textContent = user.email;
    document.getElementById('adjustCreditsCurrentBalance').textContent = user.currentCredits;

    document.getElementById('userDetailsModal').classList.remove('active');
    document.getElementById('adjustCreditsModal').classList.add('active');
}

function closeAdjustCredits() {
    document.getElementById('adjustCreditsModal').classList.remove('active');
}

function saveCreditsAdjustment() {
    const type = document.getElementById('creditsAdjustmentType').value;
    const amount = parseInt(document.getElementById('creditsAdjustmentAmount').value);
    const reason = document.getElementById('creditsAdjustmentReason').value.trim();

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    if (!reason) {
        showToast('Reason is required for credit adjustments', 'error');
        return;
    }

    const finalAmount = type === 'add' ? amount : -amount;
    addLedgerEntry(currentUser, 'admin_adjustment', finalAmount, reason);

    showToast(`Credits ${type === 'add' ? 'added' : 'deducted'} successfully`, 'success');

    closeAdjustCredits();
    loadUsersData();
    loadDashboardStats();
}

function chatWithUserFromModal() {
    closeUserDetails();
    chatWithUser(currentUser);
}

function blockUserModal() {
    if (!currentUser) return;

    if (confirm('Block this user? They will not be able to access the platform.')) {
        setUserStatus(currentUser, 'blocked');
        showToast('User blocked successfully', 'success');
        closeUserDetails();
        loadUsersData();
    }
}

function deleteUserModal() {
    if (!currentUser) return;

    if (confirm('Delete this user? This is a soft delete and can be reversed.')) {
        setUserStatus(currentUser, 'deleted');
        showToast('User deleted (soft delete)', 'success');
        closeUserDetails();
        loadUsersData();
    }
}

// ============================================
// MESSAGING & CONVERSATIONS
// ============================================

function loadConversations() {
    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    const conversations = [];

    Object.keys(users).forEach(userId => {
        const messagesData = localStorage.getItem(`VIVIANA_${userId}_MESSAGES`);
        const messages = messagesData ? JSON.parse(messagesData) : [];

        // IMPORTANT: Show ALL users, even with 0 messages (newly registered)
        let lastMessage = 'No messages yet';
        let lastActive = new Date(users[userId].createdAt);
        let unreadCount = 0;

        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            lastMessage = lastMsg.text.substring(0, 50) + (lastMsg.text.length > 50 ? '...' : '');
            lastActive = new Date(lastMsg.timestamp);

            // Count unread messages (messages from user that admin hasn't seen)
            unreadCount = messages.filter(m =>
                (m.sender_type === 'user' || m.type === 'sent') && m.read === false
            ).length;
        }

        conversations.push({
            userId: userId,
            user: users[userId],
            lastMessage: lastMessage,
            messageCount: messages.length,
            lastActive: lastActive,
            unreadCount: unreadCount,
            status: 'active'
        });
    });

    // Sort: newest first, unread first
    conversations.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return b.lastActive - a.lastActive;
    });

    renderConversations(conversations);
}

function renderConversations(conversations) {
    const tbody = document.getElementById('conversationsTableBody');

    if (conversations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No users yet</td></tr>';
        return;
    }

    tbody.innerHTML = conversations.map(conv => {
        const unreadBadge = conv.unreadCount > 0
            ? `<span class="unread-badge">${conv.unreadCount}</span>`
            : '';

        const lastMessagePreview = conv.lastMessage.length > 40
            ? conv.lastMessage.substring(0, 40) + '...'
            : conv.lastMessage;

        const rowClass = conv.unreadCount > 0 ? 'class="unread-row"' : '';

        return `
            <tr ${rowClass}>
                <td>
                    <strong>${conv.user.email}</strong>
                    ${unreadBadge}
                </td>
                <td>${lastMessagePreview}</td>
                <td>${conv.messageCount}</td>
                <td>${conv.lastActive.toLocaleString()}</td>
                <td><span class="status-badge status-active">${conv.status}</span></td>
                <td class="actions">
                    <button class="btn-small" onclick="openChatWithUser('${conv.userId}')">
                        ${conv.unreadCount > 0 ? '📬 ' : ''}Open Chat
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterConversations() {
    // Implement conversation filtering
    loadConversations();
}

function switchMessagingTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.messaging-tab').forEach(t => t.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`messaging-${tab}`).classList.add('active');

    if (tab === 'conversations') {
        loadConversations();
    } else if (tab === 'broadcast') {
        updateRecipientCount();
    }
}

function updateRecipientCount() {
    const audience = document.getElementById('broadcastAudience').value;
    let count = 0;

    const users = allUsers.filter(u => u.status === 'active');

    switch(audience) {
        case 'all':
            count = users.length;
            break;
        case 'active':
            count = users.filter(u => u.lastLogin &&
                (new Date() - new Date(u.lastLogin)) < 7 * 24 * 60 * 60 * 1000).length;
            break;
        case 'low-credits':
            count = users.filter(u => u.currentCredits < 10).length;
            break;
        case 'high-spenders':
            count = users.filter(u => u.totalPurchased > 100).length;
            break;
    }

    document.getElementById('recipientCount').textContent = count;
}

function sendBroadcast() {
    const audience = document.getElementById('broadcastAudience').value;
    const message = document.getElementById('broadcastMessage').value.trim();

    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }

    let recipients = allUsers.filter(u => u.status === 'active');

    switch(audience) {
        case 'active':
            recipients = recipients.filter(u => u.lastLogin &&
                (new Date() - new Date(u.lastLogin)) < 7 * 24 * 60 * 60 * 1000);
            break;
        case 'low-credits':
            recipients = recipients.filter(u => u.currentCredits < 10);
            break;
        case 'high-spenders':
            recipients = recipients.filter(u => u.totalPurchased > 100);
            break;
    }

    let sent = 0;
    recipients.forEach(user => {
        const messagesData = localStorage.getItem(`VIVIANA_${user.id}_MESSAGES`);
        const messages = messagesData ? JSON.parse(messagesData) : [];

        messages.push({
            type: 'received',
            text: message,
            timestamp: new Date().toISOString(),
            isAdminMessage: true // Admin messages don't cost credits
        });

        localStorage.setItem(`VIVIANA_${user.id}_MESSAGES`, JSON.stringify(messages));
        sent++;
    });

    showToast(`Broadcast sent to ${sent} users`, 'success');
    document.getElementById('broadcastMessage').value = '';
    logActivity('messaging', `Broadcast sent to ${sent} users (${audience})`);
}

function openChatWithUser(userId) {
    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    const user = users[userId];

    if (!user) {
        showToast('User not found', 'error');
        return;
    }

    // Store current chat user
    window.currentChatUserId = userId;

    // Update chat header with user info
    document.getElementById('currentChatUser').textContent = user.email || user.name;

    // Load all messages for this conversation
    loadChatMessages(userId);

    // Mark all user messages as read
    markMessagesAsRead(userId);

    // Hide dashboard, show chat screen
    document.getElementById('adminDashboard').classList.remove('active');
    document.getElementById('adminDashboard').style.display = 'none';

    document.getElementById('adminChatScreen').style.display = 'flex';
    document.getElementById('adminChatScreen').classList.add('active');

    console.log('✅ Opened chat with user:', user.email);
}

// Keep old function for backwards compatibility
function chatWithUser(userId) {
    openChatWithUser(userId);
}

function markMessagesAsRead(userId) {
    const messagesData = localStorage.getItem(`VIVIANA_${userId}_MESSAGES`);
    if (!messagesData) return;

    const messages = JSON.parse(messagesData);
    let updated = false;

    messages.forEach(msg => {
        if ((msg.sender_type === 'user' || msg.type === 'sent') && msg.read === false) {
            msg.read = true;
            updated = true;
        }
    });

    if (updated) {
        localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, JSON.stringify(messages));
    }
}

function loadChatMessages(userId) {
    const messagesContainer = document.getElementById('adminChatMessages');
    messagesContainer.innerHTML = '';

    const messagesData = localStorage.getItem(`VIVIANA_${userId}_MESSAGES`);

    if (!messagesData) {
        messagesContainer.innerHTML = '<div class="chat-empty"><p>No messages yet. Start the conversation!</p></div>';
        return;
    }

    const messages = JSON.parse(messagesData);

    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="chat-empty"><p>No messages yet. Start the conversation!</p></div>';
        return;
    }

    messages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit'
        });

        const date = new Date(msg.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        });

        const msgDiv = document.createElement('div');

        // Determine message type based on sender_type
        const isFromUser = (msg.sender_type === 'user' || msg.type === 'sent');
        const isFromViviana = (msg.sender_type === 'viviana' || msg.type === 'received');

        if (isFromUser) {
            // Message from User
            msgDiv.className = 'admin-message user-message';
            msgDiv.innerHTML = `
                <div class="admin-message-content">
                    <div class="message-sender">User</div>
                    <p>${escapeHtml(msg.text)}</p>
                    <span class="admin-message-time">${date} ${time}</span>
                </div>
            `;
        } else if (isFromViviana) {
            // Message from Viviana (Admin)
            msgDiv.className = 'admin-message viviana-message';
            const freeTag = (msg.costsCredits === false || msg.isAdminMessage) ? ' <span class="free-tag">FREE</span>' : '';
            msgDiv.innerHTML = `
                <div class="admin-message-content">
                    <div class="message-sender">Viviana${freeTag}</div>
                    <p>${escapeHtml(msg.text)}</p>
                    <span class="admin-message-time">${date} ${time}</span>
                </div>
            `;
        }

        messagesContainer.appendChild(msgDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendAdminMessage() {
    const input = document.getElementById('adminMessageInput');
    const text = input.value.trim();

    if (!text || !window.currentChatUserId) {
        if (!text) showToast('Please enter a message', 'error');
        return;
    }

    const userId = window.currentChatUserId;
    const messagesData = localStorage.getItem(`VIVIANA_${userId}_MESSAGES`);
    const messages = messagesData ? JSON.parse(messagesData) : [];

    // Create message object with NEW DATA MODEL
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const newMessage = {
        id: messageId,
        type: 'received',
        sender_type: 'viviana', // Message from Viviana
        text: text,
        timestamp: new Date().toISOString(),
        costsCredits: false, // Viviana messages are FREE
        isAdminMessage: true,
        read: true // Admin has seen it (we just sent it)
    };

    messages.push(newMessage);
    localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, JSON.stringify(messages));

    // Display message in chat
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const msgDiv = document.createElement('div');
    msgDiv.className = 'admin-message viviana-message';
    msgDiv.innerHTML = `
        <div class="admin-message-content">
            <div class="message-sender">Viviana <span class="free-tag">FREE</span></div>
            <p>${escapeHtml(text)}</p>
            <span class="admin-message-time">${date} ${time}</span>
        </div>
    `;

    document.getElementById('adminChatMessages').appendChild(msgDiv);
    document.getElementById('adminChatMessages').scrollTop =
        document.getElementById('adminChatMessages').scrollHeight;

    input.value = '';

    // Log activity
    logActivity('messaging', `Viviana replied to user ${userId}`);

    // Show success toast
    showToast('Message sent as Viviana', 'success');

    console.log('✅ Message sent as Viviana to user:', userId);
}

function backToMessaging() {
    // Hide chat screen
    document.getElementById('adminChatScreen').classList.remove('active');
    document.getElementById('adminChatScreen').style.display = 'none';

    // Show dashboard
    document.getElementById('adminDashboard').style.display = 'flex';
    document.getElementById('adminDashboard').classList.add('active');

    // Navigate to messaging section
    showSection('messaging');

    // Clear current chat user
    window.currentChatUserId = null;

    // Reload conversations to update unread counts
    loadConversations();

    console.log('✅ Returned to messaging inbox');
}

// ============================================
// FINANCE & PAYMENTS
// ============================================

function loadFinanceData() {
    // Simulated payment data - in production this would come from payment provider
    const payments = [];

    allUsers.forEach(user => {
        const ledger = getCreditsLedger(user.id);
        ledger.filter(entry => entry.type === 'purchase').forEach(entry => {
            payments.push({
                date: new Date(entry.timestamp),
                userId: user.id,
                userEmail: user.email,
                credits: entry.amount,
                amount: entry.amount * 0.10, // $0.10 per credit
                status: 'paid',
                providerId: entry.referenceId || 'N/A'
            });
        });
    });

    payments.sort((a, b) => b.date - a.date);
    renderPaymentsTable(payments);
    calculateRevenueStats(payments);
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');

    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No payment data</td></tr>';
        return;
    }

    tbody.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.date.toLocaleDateString()}</td>
            <td>${payment.userEmail}</td>
            <td>${payment.credits}</td>
            <td>$${payment.amount.toFixed(2)}</td>
            <td><span class="status-badge status-active">${payment.status}</span></td>
            <td><code>${payment.providerId}</code></td>
            <td class="actions">
                <button class="btn-small" onclick="viewPaymentDetails('${payment.providerId}')">Details</button>
            </td>
        </tr>
    `).join('');
}

function calculateRevenueStats(payments) {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const revenueToday = payments
        .filter(p => p.date >= oneDayAgo)
        .reduce((sum, p) => sum + p.amount, 0);

    const revenue7d = payments
        .filter(p => p.date >= sevenDaysAgo)
        .reduce((sum, p) => sum + p.amount, 0);

    const revenue30d = payments
        .filter(p => p.date >= thirtyDaysAgo)
        .reduce((sum, p) => sum + p.amount, 0);

    document.getElementById('revenueToday').textContent = '$' + revenueToday.toFixed(2);
    document.getElementById('revenue7d').textContent = '$' + revenue7d.toFixed(2);
    document.getElementById('revenue30d').textContent = '$' + revenue30d.toFixed(2);
    document.getElementById('pendingPayments').textContent = '0';
}

function filterPayments() {
    // Implement payment filtering
    loadFinanceData();
}

function exportFinanceData() {
    showToast('Exporting financial data...', 'info');
    // Implement CSV export
}

function viewPaymentDetails(providerId) {
    showToast('Payment details: ' + providerId, 'info');
}

// ============================================
// ANALYTICS
// ============================================

function loadAnalytics() {
    calculateActiveUsers();
    calculateCreditsConsumption();
    calculateEngagement();
    calculateConversionFunnel();
    loadTopBuyers();
}

function setAnalyticsRange(range) {
    analyticsRange = range;

    document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    loadAnalytics();
}

function calculateActiveUsers() {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const dau = allUsers.filter(u => u.lastLogin && new Date(u.lastLogin) >= oneDayAgo).length;
    const wau = allUsers.filter(u => u.lastLogin && new Date(u.lastLogin) >= sevenDaysAgo).length;
    const mau = allUsers.filter(u => u.lastLogin && new Date(u.lastLogin) >= thirtyDaysAgo).length;

    document.getElementById('dau').textContent = dau;
    document.getElementById('wau').textContent = wau;
    document.getElementById('mau').textContent = mau;
}

function calculateCreditsConsumption() {
    const totalConsumed = allUsers.reduce((sum, u) => sum + u.totalConsumed, 0);
    const avgPerUser = allUsers.length > 0 ? (totalConsumed / allUsers.length).toFixed(1) : 0;

    document.getElementById('creditsPerDay').textContent = (totalConsumed / 30).toFixed(0);
    document.getElementById('creditsPerWeek').textContent = (totalConsumed / 4).toFixed(0);
    document.getElementById('avgCreditsPerUser').textContent = avgPerUser;
}

function calculateEngagement() {
    let totalMessages = 0;

    allUsers.forEach(user => {
        const messagesData = localStorage.getItem(`VIVIANA_${user.id}_MESSAGES`);
        if (messagesData) {
            totalMessages += JSON.parse(messagesData).length;
        }
    });

    const avgChats = allUsers.length > 0 ? (totalMessages / allUsers.length).toFixed(1) : 0;

    document.getElementById('avgChatsPerUser').textContent = avgChats;
    document.getElementById('totalMessagesSent').textContent = totalMessages;
}

function calculateConversionFunnel() {
    const signups = allUsers.length;
    const firstMessage = allUsers.filter(u => {
        const messages = localStorage.getItem(`VIVIANA_${u.id}_MESSAGES`);
        return messages && JSON.parse(messages).length > 0;
    }).length;
    const firstPurchase = allUsers.filter(u => u.totalPurchased > 0).length;

    document.getElementById('funnelSignups').textContent = signups;
    document.getElementById('funnelFirstMessage').textContent = firstMessage;
    document.getElementById('funnelFirstPurchase').textContent = firstPurchase;
}

function loadTopBuyers() {
    const topBuyers = [...allUsers]
        .filter(u => u.totalPurchased > 0)
        .sort((a, b) => b.totalPurchased - a.totalPurchased)
        .slice(0, 10);

    const tbody = document.getElementById('topBuyersTableBody');

    if (topBuyers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No purchase data</td></tr>';
        return;
    }

    tbody.innerHTML = topBuyers.map((user, index) => {
        const totalSpent = user.totalPurchased * 0.10;
        const ledger = getCreditsLedger(user.id);
        const lastPurchase = ledger
            .filter(e => e.type === 'purchase')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${user.email}</td>
                <td>${user.totalPurchased}</td>
                <td>$${totalSpent.toFixed(2)}</td>
                <td>${lastPurchase ? new Date(lastPurchase.timestamp).toLocaleDateString() : 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// SETTINGS
// ============================================

function initializeSystemSettings() {
    // Load existing settings
    const costPerMessage = localStorage.getItem('VIVIANA_COST_PER_MESSAGE') || '1';
    const freeCredits = localStorage.getItem('VIVIANA_FREE_CREDITS') || '3';

    if (document.getElementById('costPerMessage')) {
        document.getElementById('costPerMessage').value = costPerMessage;
        document.getElementById('freeCreditsNewUser').value = freeCredits;
    }

    loadCreditPackages();
}

function toggleMaintenanceMode() {
    const enabled = document.getElementById('maintenanceMode').checked;
    localStorage.setItem('VIVIANA_MAINTENANCE_MODE', enabled);
    logActivity('settings', `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
}

function saveMaintenanceSettings() {
    const message = document.getElementById('maintenanceMessage').value;
    localStorage.setItem('VIVIANA_MAINTENANCE_MESSAGE', message);
    showToast('Maintenance settings saved', 'success');
}

function saveCreditSettings() {
    const costPerMessage = document.getElementById('costPerMessage').value;
    const freeCredits = document.getElementById('freeCreditsNewUser').value;

    localStorage.setItem('VIVIANA_COST_PER_MESSAGE', costPerMessage);
    localStorage.setItem('VIVIANA_FREE_CREDITS', freeCredits);

    showToast('Credit settings saved', 'success');
    logActivity('settings', 'Credit system settings updated');
}

function loadCreditPackages() {
    const packagesData = localStorage.getItem('VIVIANA_CREDIT_PACKAGES');
    const packages = packagesData ? JSON.parse(packagesData) : [
        { credits: 10, price: 0.99, name: 'Starter' },
        { credits: 50, price: 4.49, name: 'Popular' },
        { credits: 200, price: 15.99, name: 'Pro' }
    ];

    if (!packagesData) {
        localStorage.setItem('VIVIANA_CREDIT_PACKAGES', JSON.stringify(packages));
    }

    const container = document.getElementById('packagesList');
    if (!container) return;

    container.innerHTML = packages.map((pkg, index) => `
        <div class="package-item">
            <div class="package-info">
                <strong>${pkg.name}</strong>
                <p>${pkg.credits} credits - $${pkg.price.toFixed(2)}</p>
            </div>
            <button class="btn-small btn-danger" onclick="deletePackage(${index})">Delete</button>
        </div>
    `).join('');
}

function addNewPackage() {
    const name = prompt('Package name:');
    if (!name) return;

    const credits = parseInt(prompt('Number of credits:'));
    if (!credits) return;

    const price = parseFloat(prompt('Price (USD):'));
    if (!price) return;

    const packages = JSON.parse(localStorage.getItem('VIVIANA_CREDIT_PACKAGES') || '[]');
    packages.push({ name, credits, price });
    localStorage.setItem('VIVIANA_CREDIT_PACKAGES', JSON.stringify(packages));

    loadCreditPackages();
    showToast('Package added successfully', 'success');
}

function deletePackage(index) {
    if (!confirm('Delete this package?')) return;

    const packages = JSON.parse(localStorage.getItem('VIVIANA_CREDIT_PACKAGES') || '[]');
    packages.splice(index, 1);
    localStorage.setItem('VIVIANA_CREDIT_PACKAGES', JSON.stringify(packages));

    loadCreditPackages();
    showToast('Package deleted', 'success');
}

function filterLogs() {
    loadErrorLogs();
}

function loadErrorLogs() {
    const logs = JSON.parse(localStorage.getItem('VIVIANA_ERROR_LOGS') || '[]');
    const container = document.getElementById('logsContainer');

    if (logs.length === 0) {
        container.innerHTML = '<p class="no-data">No error logs</p>';
        return;
    }

    container.innerHTML = logs.slice(-50).reverse().map(log => `
        <div class="log-entry log-${log.severity}">
            <strong>${log.timestamp}</strong> [${log.module}] ${log.message}
        </div>
    `).join('');
}

function clearLogs() {
    if (confirm('Clear all error logs?')) {
        localStorage.setItem('VIVIANA_ERROR_LOGS', '[]');
        loadErrorLogs();
        showToast('Logs cleared', 'success');
    }
}

// ============================================
// SUPPORT
// ============================================

function loadSupportTickets() {
    const tickets = JSON.parse(localStorage.getItem('VIVIANA_SUPPORT_TICKETS') || '[]');
    const tbody = document.getElementById('supportTableBody');

    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No support tickets</td></tr>';
        return;
    }

    tbody.innerHTML = tickets.map(ticket => `
        <tr>
            <td>${new Date(ticket.date).toLocaleDateString()}</td>
            <td>${ticket.userEmail}</td>
            <td>${ticket.subject}</td>
            <td><span class="status-badge status-${ticket.status}">${ticket.status}</span></td>
            <td class="actions">
                <button class="btn-small" onclick="viewTicket('${ticket.id}')">View</button>
            </td>
        </tr>
    `).join('');
}

function filterSupportTickets() {
    loadSupportTickets();
}

function viewTicket(ticketId) {
    showToast('Viewing ticket: ' + ticketId, 'info');
}

// ============================================
// DASHBOARD & STATS
// ============================================

function loadDashboardStats() {
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const totalCredits = allUsers.reduce((sum, u) => sum + u.currentCredits, 0);
    const creditsConsumed = allUsers.reduce((sum, u) => sum + u.totalConsumed, 0);
    const totalRevenue = allUsers.reduce((sum, u) => sum + (u.totalPurchased * 0.10), 0);

    let totalMessages = 0;
    let messagesToday = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    allUsers.forEach(user => {
        const messagesData = localStorage.getItem(`VIVIANA_${user.id}_MESSAGES`);
        if (messagesData) {
            const messages = JSON.parse(messagesData);
            totalMessages += messages.length;
            messagesToday += messages.filter(m => new Date(m.timestamp) >= oneDayAgo).length;
        }
    });

    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('totalCredits').textContent = totalCredits;
    document.getElementById('creditsConsumed').textContent = creditsConsumed;
    document.getElementById('totalRevenue').textContent = '$' + totalRevenue.toFixed(2);
    document.getElementById('totalMessages').textContent = totalMessages;
    document.getElementById('messagesToday').textContent = messagesToday;

    // Calculate this month revenue
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    let revenueThisMonth = 0;
    allUsers.forEach(user => {
        const ledger = getCreditsLedger(user.id);
        revenueThisMonth += ledger
            .filter(e => e.type === 'purchase' && new Date(e.timestamp) >= thisMonth)
            .reduce((sum, e) => sum + (e.amount * 0.10), 0);
    });

    document.getElementById('revenueThisMonth').textContent = '$' + revenueThisMonth.toFixed(2) + ' this month';

    loadRecentActivity();
}

function loadRecentActivity() {
    const logs = JSON.parse(localStorage.getItem('VIVIANA_ACTIVITY_LOG') || '[]');
    const container = document.getElementById('recentActivity');

    if (logs.length === 0) {
        container.innerHTML = '<p class="no-data">No recent activity</p>';
        return;
    }

    container.innerHTML = logs.slice(-10).reverse().map(log => `
        <div class="activity-item">
            <span class="activity-time">${new Date(log.timestamp).toLocaleString()}</span>
            <span class="activity-text">${log.message}</span>
        </div>
    `).join('');
}

// ============================================
// NAVIGATION & UI
// ============================================

function showSection(section) {
    currentSection = section;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });

    const navItem = document.querySelector(`[data-section="${section}"]`);
    if (navItem) navItem.classList.add('active');

    const sectionElement = document.getElementById(`section-${section}`);
    if (sectionElement) sectionElement.classList.add('active');

    // Load section-specific data
    switch(section) {
        case 'dashboard':
            loadAllData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'messaging':
            loadConversations();
            break;
        case 'finance':
            loadFinanceData();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadErrorLogs();
            break;
        case 'support':
            loadSupportTickets();
            break;
    }
}

function loadAllData() {
    loadUsersData();
    loadDashboardStats();
}

function exportData() {
    showToast('Exporting data...', 'info');
    // Implement full data export
}

function showBroadcastModal() {
    showSection('messaging');
    switchMessagingTab('broadcast');
}

function adminLogout() {
    if (confirm('Logout from admin panel?')) {
        document.getElementById('adminDashboard').classList.remove('active');
        document.getElementById('adminChatScreen').classList.remove('active');
        document.getElementById('adminLoginScreen').classList.add('active');
    }
}

// ============================================
// DEBUG: FIND USER BY EMAIL
// ============================================

function debugFindUserByEmail() {
    const email = document.getElementById('debugEmailSearch').value.trim().toLowerCase();
    const resultDiv = document.getElementById('debugSearchResult');

    if (!email) {
        resultDiv.innerHTML = '<span style="color: #dc3545;">⚠️ Please enter an email address</span>';
        return;
    }

    console.log('🔍 DEBUG: Searching for email:', email);

    // Search in VIVIANA_USERS
    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    let foundUserId = null;
    let userData = null;

    for (let userId in users) {
        if (users[userId].email.toLowerCase() === email) {
            foundUserId = userId;
            userData = users[userId];
            break;
        }
    }

    if (!foundUserId) {
        resultDiv.innerHTML = `
            <div style="background: #f8d7da; padding: 10px; border-radius: 6px; border-left: 4px solid #dc3545; margin-top: 10px;">
                <strong style="color: #721c24;">❌ NOT FOUND</strong><br>
                <span style="color: #721c24;">Email: <code>${email}</code></span><br>
                <span style="color: #721c24;">Source: VIVIANA_USERS (localStorage)</span><br>
                <span style="color: #721c24;">Total users in database: <strong>${Object.keys(users).length}</strong></span>
            </div>
        `;
        console.log('❌ User not found');
        console.log('Total users in database:', Object.keys(users).length);
        return;
    }

    // Get additional data
    const status = localStorage.getItem(`VIVIANA_${foundUserId}_STATUS`) || 'active';
    const credits = localStorage.getItem(`VIVIANA_${foundUserId}_CREDITS`) || '0';
    const lastLogin = localStorage.getItem(`VIVIANA_${foundUserId}_LAST_LOGIN`) || 'Never';
    const emailVerified = localStorage.getItem(`VIVIANA_${foundUserId}_EMAIL_VERIFIED`) === 'true';

    // Count associated keys
    let associatedKeys = [];
    const prefix = `VIVIANA_${foundUserId}_`;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            associatedKeys.push(key.replace(prefix, ''));
        }
    }

    resultDiv.innerHTML = `
        <div style="background: #d4edda; padding: 12px; border-radius: 6px; border-left: 4px solid #28a745; margin-top: 10px;">
            <strong style="color: #155724;">✅ FOUND</strong><br>
            <div style="margin-top: 8px; color: #155724; line-height: 1.6;">
                <strong>User ID:</strong> <code>${foundUserId}</code><br>
                <strong>Email:</strong> <code>${userData.email}</code><br>
                <strong>Name:</strong> ${userData.name || 'N/A'}<br>
                <strong>Status:</strong> <span style="font-weight: bold; color: ${status === 'deleted' ? '#dc3545' : '#28a745'}">${status}</span><br>
                <strong>Email Verified:</strong> ${emailVerified ? '✅ Yes' : '❌ No'}<br>
                <strong>Credits:</strong> ${credits}<br>
                <strong>Created:</strong> ${new Date(userData.createdAt).toLocaleString()}<br>
                <strong>Last Login:</strong> ${lastLogin !== 'Never' ? new Date(lastLogin).toLocaleString() : 'Never'}<br>
                <strong>Associated Keys:</strong> ${associatedKeys.length} (${associatedKeys.join(', ')})<br>
                <strong>Source:</strong> localStorage → VIVIANA_USERS
            </div>
        </div>
    `;

    console.log('✅ User found:', {
        userId: foundUserId,
        email: userData.email,
        status: status,
        emailVerified: emailVerified,
        credits: credits,
        associatedKeys: associatedKeys
    });
}

function debugCheckTargetEmails() {
    const targetEmails = [
        'yana.annatar.schwarz@proton.me',
        'simon.brandhorst@icloud.com'
    ];

    const resultDiv = document.getElementById('debugSearchResult');
    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');

    console.log('🎯 DEBUG: Checking target emails...');
    console.log('Total users in database:', Object.keys(users).length);

    let html = '<div style="margin-top: 10px;">';
    html += '<strong style="color: #856404;">Target Emails Status:</strong><br><br>';

    targetEmails.forEach(email => {
        let found = false;
        let userId = null;
        let userData = null;

        for (let uid in users) {
            if (users[uid].email.toLowerCase() === email.toLowerCase()) {
                found = true;
                userId = uid;
                userData = users[uid];
                break;
            }
        }

        if (found) {
            const status = localStorage.getItem(`VIVIANA_${userId}_STATUS`) || 'active';
            const statusColor = status === 'deleted' ? '#dc3545' : '#28a745';

            html += `
                <div style="background: #d4edda; padding: 10px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 10px;">
                    <strong style="color: #155724;">✅ ${email}</strong><br>
                    <span style="color: #155724; font-size: 12px;">
                        User ID: <code>${userId.substring(0, 20)}...</code><br>
                        Status: <span style="color: ${statusColor}; font-weight: bold;">${status}</span><br>
                        Created: ${new Date(userData.createdAt).toLocaleString()}
                    </span>
                </div>
            `;
            console.log('✅ Found:', email, '→', userId, '→ Status:', status);
        } else {
            html += `
                <div style="background: #f8d7da; padding: 10px; border-radius: 6px; border-left: 4px solid #dc3545; margin-bottom: 10px;">
                    <strong style="color: #721c24;">❌ ${email}</strong><br>
                    <span style="color: #721c24; font-size: 12px;">Not found in VIVIANA_USERS</span>
                </div>
            `;
            console.log('❌ Not found:', email);
        }
    });

    html += '</div>';
    resultDiv.innerHTML = html;
}

// ============================================
// SEARCH & PURGE USER
// ============================================

function searchUserByEmail() {
    const email = document.getElementById('purgeUserEmail').value.trim().toLowerCase();
    const resultDiv = document.getElementById('purgeSearchResult');

    if (!email) {
        resultDiv.innerHTML = '<span style="color: #f44336;">⚠️ Please enter an email address</span>';
        return;
    }

    // Search in VIVIANA_USERS
    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    let foundUserId = null;

    for (let userId in users) {
        if (users[userId].email === email) {
            foundUserId = userId;
            break;
        }
    }

    if (!foundUserId) {
        resultDiv.innerHTML = '<span style="color: #4CAF50;">✅ No user found with this email</span>';
        return;
    }

    // Count references
    let refCount = 0;
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
        if (localStorage.getItem(key)) refCount++;
    });

    resultDiv.innerHTML = `
        <div style="background: #fff3cd; padding: 10px; border-radius: 4px; border: 1px solid #ffc107;">
            <strong>⚠️ User Found:</strong><br>
            Email: <code>${email}</code><br>
            User ID: <code>${foundUserId.substring(0, 20)}...</code><br>
            References: <strong>${refCount + 1}</strong> items<br>
            <small style="color: #666;">Click "Purge" to permanently delete</small>
        </div>
    `;
}

function purgeUserByEmailAdmin() {
    const email = document.getElementById('purgeUserEmail').value.trim().toLowerCase();
    const resultDiv = document.getElementById('purgeSearchResult');

    if (!email) {
        showToast('Please enter an email address', 'error');
        return;
    }

    if (!confirm(`⚠️ WARNING ⚠️\n\nThis will PERMANENTLY delete the user with email:\n${email}\n\nThis includes:\n- User account\n- All messages\n- All credits & transactions\n- All profile data\n- Payment history\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`)) {
        return;
    }

    console.log('🗑️ ADMIN PURGE: Starting purge for email:', email);

    const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
    let foundUserId = null;

    // Find user by email
    for (let userId in users) {
        if (users[userId].email === email) {
            foundUserId = userId;
            break;
        }
    }

    if (!foundUserId) {
        resultDiv.innerHTML = '<span style="color: #4CAF50;">✅ No user found with this email</span>';
        showToast('No user found', 'info');
        return;
    }

    let deletedItems = 0;

    // 1. Remove from VIVIANA_USERS
    delete users[foundUserId];
    localStorage.setItem('VIVIANA_USERS', JSON.stringify(users));
    deletedItems++;

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
        }
    });

    // 3. Remove any orphaned keys with this userId
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.includes(foundUserId)) {
            localStorage.removeItem(key);
            deletedItems++;
        }
    }

    // 4. Clean up payments
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('VIVIANA_PAYMENT_')) {
            try {
                const paymentData = JSON.parse(localStorage.getItem(key));
                if (paymentData.userId === foundUserId) {
                    localStorage.removeItem(key);
                    deletedItems++;
                }
            } catch (e) {
                // Skip
            }
        }
    }

    // 5. If this is the current user, log them out
    const currentUserId = localStorage.getItem('VIVIANA_CURRENT_USER_ID');
    if (currentUserId === foundUserId) {
        localStorage.removeItem('VIVIANA_CURRENT_USER_ID');
    }

    console.log('✅ PURGE COMPLETE');
    console.log('User ID:', foundUserId);
    console.log('Items deleted:', deletedItems);

    resultDiv.innerHTML = `
        <div style="background: #d4edda; padding: 10px; border-radius: 4px; border: 1px solid #28a745;">
            <strong>✅ User Purged Successfully</strong><br>
            Email: <code>${email}</code><br>
            User ID: <code>${foundUserId.substring(0, 20)}...</code><br>
            Items deleted: <strong>${deletedItems}</strong>
        </div>
    `;

    showToast(`User purged: ${deletedItems} items deleted`, 'success');
    logActivity('users', `Purged user ${email} - ${deletedItems} items deleted`);

    // Clear input
    document.getElementById('purgeUserEmail').value = '';

    // Reload user data
    setTimeout(() => {
        loadAllData();
    }, 1000);
}

// ============================================
// DATA CLEANUP & RESET
// ============================================

function cleanupAllUserData() {
    if (!confirm('⚠️ WARNING: This will DELETE ALL user data except Viviana!\n\nThis action cannot be undone. Continue?')) {
        return;
    }

    if (!confirm('🔴 FINAL CONFIRMATION: Really delete all users and their data?')) {
        return;
    }

    console.log('🗑️ Starting data cleanup...');

    try {
        // Get all users
        const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
        const userIds = Object.keys(users);

        let deletedCount = 0;

        userIds.forEach(userId => {
            // Delete user-specific data
            localStorage.removeItem(`VIVIANA_${userId}_CREDITS`);
            localStorage.removeItem(`VIVIANA_${userId}_BIO`);
            localStorage.removeItem(`VIVIANA_${userId}_PROFILE_PIC`);
            localStorage.removeItem(`VIVIANA_${userId}_MESSAGES`);
            localStorage.removeItem(`VIVIANA_${userId}_LAST_LOGIN`);
            localStorage.removeItem(`VIVIANA_${userId}_STATUS`);
            localStorage.removeItem(`VIVIANA_LEDGER_${userId}`);

            deletedCount++;
        });

        // Clear VIVIANA_USERS
        localStorage.setItem('VIVIANA_USERS', '{}');

        // Clear current user
        localStorage.removeItem('VIVIANA_CURRENT_USER_ID');

        // Clear activity logs
        localStorage.setItem('VIVIANA_ACTIVITY_LOG', '[]');
        localStorage.setItem('VIVIANA_ERROR_LOGS', '[]');

        // Clear support tickets
        localStorage.setItem('VIVIANA_SUPPORT_TICKETS', '[]');

        console.log(`✅ Deleted ${deletedCount} users and all related data`);

        showToast(`Successfully deleted ${deletedCount} users and cleaned up all data`, 'success');

        // Reload data
        loadAllData();

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        showToast('Error during cleanup: ' + error.message, 'error');
        logError('system', 'error', 'Data cleanup failed: ' + error.message);
    }
}

// ============================================
// UTILITIES
// ============================================

function logActivity(module, message) {
    const logs = JSON.parse(localStorage.getItem('VIVIANA_ACTIVITY_LOG') || '[]');
    logs.push({
        timestamp: new Date().toISOString(),
        module: module,
        message: message
    });

    // Keep only last 100 entries
    if (logs.length > 100) {
        logs.shift();
    }

    localStorage.setItem('VIVIANA_ACTIVITY_LOG', JSON.stringify(logs));
}

function logError(module, severity, message) {
    const logs = JSON.parse(localStorage.getItem('VIVIANA_ERROR_LOGS') || '[]');
    logs.push({
        timestamp: new Date().toISOString(),
        module: module,
        severity: severity,
        message: message
    });

    if (logs.length > 100) {
        logs.shift();
    }

    localStorage.setItem('VIVIANA_ERROR_LOGS', JSON.stringify(logs));
}

function generateId() {
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16)
    );
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('adminToast');
    toast.textContent = message;
    toast.className = `admin-toast show toast-${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
