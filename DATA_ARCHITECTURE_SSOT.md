# Data Architecture - Single Source of Truth (SSOT)

## 🎯 Current System: localStorage-Based Architecture

**Tech Stack:**
- **No Backend Database** (pure frontend)
- **Storage:** Browser localStorage
- **Scope:** Per-browser, per-user-profile
- **Persistence:** Until user clears browser data

---

## 📊 SINGLE SOURCE OF TRUTH

### **Primary Key:** `VIVIANA_USERS`

**Type:** JSON Object (stringified in localStorage)

**Structure:**
```javascript
VIVIANA_USERS = {
    "user_1738347123456_abc123": {
        name: "John Doe",
        email: "john@example.com",
        password: "hashed_password",  // WARNING: Currently plaintext!
        emailVerified: boolean,
        createdAt: "2024-01-31T10:00:00Z",
        status: "active" | "deleted" | "blocked"  // Only if explicitly set
    },
    "user_1738347234567_def456": { ... }
}
```

**This is the ONLY place where:**
- ✅ User accounts are created
- ✅ Emails are stored
- ✅ Account existence is checked
- ✅ User lookup happens

**All other data REFERENCES this via `userId`**

---

## 🗂️ DATA RELATIONSHIP MAP

### **Tier 1: Core Identity** (SINGLE SOURCE OF TRUTH)
```
VIVIANA_USERS
├── userId (generated, unique)
├── email (unique, lowercase)
├── name
├── password
├── emailVerified
├── createdAt
└── status (optional, defaults to "active")
```

---

### **Tier 2: User Metadata** (References `userId`)

#### **Profile Data:**
```
VIVIANA_${userId}_BIO                → string
VIVIANA_${userId}_PROFILE_PIC        → base64 string
```

#### **Account Status:**
```
VIVIANA_${userId}_STATUS             → "active" | "deleted" | "blocked"
VIVIANA_${userId}_EMAIL_VERIFIED     → "true" | "false"
VIVIANA_${userId}_LAST_LOGIN         → ISO timestamp
```

#### **Settings:**
```
VIVIANA_${userId}_NOTIFICATION_SETTINGS  → JSON object
VIVIANA_${userId}_PRIVACY_SETTINGS       → JSON object
```

---

### **Tier 3: Credits System** (References `userId`)

```
VIVIANA_${userId}_CREDITS            → number (current balance)
VIVIANA_${userId}_CREDITS_LEDGER     → JSON array of transactions
```

**Ledger Entry Structure:**
```javascript
{
    id: "txn_1738347234567_abc",
    timestamp: "2024-01-31T10:00:00Z",
    event_type: "initial_grant" | "purchase" | "spend" | "admin_adjust" | "refund",
    amount: number,  // positive = add, negative = subtract
    balance_before: number,
    balance_after: number,
    description: string,
    metadata: {
        signup_date?: ISO timestamp,
        payment_id?: string,
        message_id?: string,
        admin_id?: string
    }
}
```

---

### **Tier 4: Conversations & Messages** (References `userId`)

```
VIVIANA_${userId}_MESSAGES           → JSON array
```

**Message Structure:**
```javascript
{
    id: "msg_1738347234567_abc",
    text: string,
    timestamp: "2024-01-31T10:00:00Z",
    sender_type: "user" | "viviana",
    costsCredits: boolean
}
```

---

## 🔧 USER CREATION FLOW (Signup)

### **Location:** `script.js` → `handleSignup(e)`

**Step-by-Step:**

#### **1. Validation**
- Check all fields filled
- Password ≥ 6 characters
- Rate limiting check

#### **2. Duplicate Check**
```javascript
// Method 1: searchUserReferences(email)
// Method 2: findUserByEmail(email)
// Both check VIVIANA_USERS
```

#### **3. User Creation** (Atomic-style)
```javascript
const userId = generateUserId();  // "user_" + timestamp + "_" + random

// STEP 1: Save to VIVIANA_USERS (SSOT)
saveUserToDatabase(userId, name, email, password, false);

// STEP 2: Initialize metadata
localStorage.setItem(`VIVIANA_${userId}_BIO`, '');
localStorage.setItem(`VIVIANA_${userId}_PROFILE_PIC`, '');
localStorage.setItem(`VIVIANA_${userId}_MESSAGES`, '[]');
localStorage.setItem(`VIVIANA_${userId}_LAST_LOGIN`, new Date().toISOString());
localStorage.setItem(`VIVIANA_${userId}_EMAIL_VERIFIED`, 'false');
localStorage.setItem(`VIVIANA_${userId}_STATUS`, 'active');

// STEP 3: Initialize credits with ledger
localStorage.setItem(`VIVIANA_${userId}_CREDITS`, '3');
addCreditsLedgerEntry(userId, {
    type: 'initial_grant',
    amount: 3,
    balance_before: 0,
    balance_after: 3,
    description: 'Welcome bonus - New user signup',
    metadata: { signup_date: new Date().toISOString() }
});

// STEP 4: Settings (if needed)
// Created on-demand when user opens settings screens
```

**Result:**
- ✅ User in `VIVIANA_USERS`
- ✅ All metadata initialized
- ✅ Credits ledger with initial grant
- ✅ Consistent state (no partial creation)

---

## 📖 USER RETRIEVAL (Admin Panel)

### **Location:** `admin-script.js` → `loadUsersData()`

**Current Implementation:**
```javascript
function loadUsersData() {
    const usersData = localStorage.getItem('VIVIANA_USERS');

    if (!usersData || usersData === '{}') {
        // No users found
        return;
    }

    const users = JSON.parse(usersData);

    // Map to enriched user objects
    allUsers = Object.keys(users).map(userId => ({
        id: userId,
        ...users[userId],  // name, email, password, emailVerified, createdAt
        status: getUserStatus(userId),  // from VIVIANA_${userId}_STATUS
        currentCredits: getCurrentCredits(userId),
        totalPurchased: getTotalPurchased(userId),
        totalConsumed: getTotalConsumed(userId),
        lastLogin: getLastLogin(userId)
    }));

    renderUsersTable(allUsers);
}
```

**Data Flow:**
```
VIVIANA_USERS (SSOT)
    ↓
Object.keys(users) → [userId1, userId2, ...]
    ↓
For each userId:
    - Get core data from VIVIANA_USERS
    - Enrich with metadata from VIVIANA_${userId}_*
    ↓
allUsers[] → Render table
```

**No Filters Applied!**
- ✅ Shows ALL users (active, deleted, blocked)
- ✅ Shows unverified users
- ✅ Shows all statuses

---

## 🚨 CRITICAL FINDING: WHY USERS MIGHT BE INVISIBLE

### **Root Causes:**

#### ❌ **Cause 1: User Never Created**
**Symptom:**
- Email not found in `VIVIANA_USERS`
- Debug tool shows "NOT FOUND"

**Reasons:**
1. Signup never completed (form error)
2. Browser localStorage cleared
3. Different browser/profile used
4. Incognito mode (separate storage)

**Fix:**
→ Re-register the account in `index.html`

---

#### ❌ **Cause 2: Partial Creation (Inconsistent State)**
**Symptom:**
- User in `VIVIANA_USERS` but missing metadata
- Admin panel shows but with errors

**Reasons:**
1. Browser crash during signup
2. localStorage quota exceeded
3. Code error in initialization

**Fix:**
→ Use migration tool to complete initialization

---

#### ❌ **Cause 3: Soft-Deleted User**
**Symptom:**
- User in `VIVIANA_USERS` with `status: "deleted"`
- Email anonymized to `deleted_${userId}@deleted.local`

**Why it happens:**
User clicked "Delete Account" → Soft-delete marks:
```javascript
user.status = "deleted"
user.email = "deleted_${userId}@deleted.local"
user.password = null
user.name = "Deleted User"
```

**Visibility:**
- ✅ Still visible in Admin Panel (status badge shows "deleted")
- ❌ Cannot login anymore

**Fix:**
→ Not a bug! User is visible but marked deleted

---

#### ❌ **Cause 4: Browser localStorage Isolation**
**Symptom:**
- User exists in Chrome but not Firefox
- User exists in normal mode but not incognito

**Reason:**
localStorage is **per-browser, per-profile**:
- Chrome !== Firefox
- Normal mode !== Incognito
- User Profile A !== User Profile B

**Fix:**
→ Open Admin Panel in SAME browser where signup happened

---

## ✅ VERIFICATION: Data Integrity Check

### **Run in Browser Console:**

#### **1. Check VIVIANA_USERS exists:**
```javascript
const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
console.log('Total users:', Object.keys(users).length);
console.log('Emails:', Object.values(users).map(u => u.email));
```

#### **2. Find specific email:**
```javascript
const email = 'yana.annatar.schwarz@proton.me';
const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
const found = Object.entries(users).find(([id, u]) => u.email === email);
console.log(found ? `Found: ${found[0]}` : 'Not found');
```

#### **3. Check user metadata:**
```javascript
const userId = 'user_1738347123456_abc123';  // Replace with actual ID
const keys = [];
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`VIVIANA_${userId}_`)) {
        keys.push(key);
    }
}
console.log('User keys:', keys);
```

#### **4. Validate data consistency:**
```javascript
const users = JSON.parse(localStorage.getItem('VIVIANA_USERS') || '{}');
Object.entries(users).forEach(([userId, user]) => {
    const hasCredits = localStorage.getItem(`VIVIANA_${userId}_CREDITS`) !== null;
    const hasLedger = localStorage.getItem(`VIVIANA_${userId}_CREDITS_LEDGER`) !== null;
    const hasMessages = localStorage.getItem(`VIVIANA_${userId}_MESSAGES`) !== null;

    console.log(userId.substring(0, 20), {
        email: user.email,
        credits: hasCredits,
        ledger: hasLedger,
        messages: hasMessages,
        complete: hasCredits && hasLedger && hasMessages
    });
});
```

---

## 🔧 CURRENT ARCHITECTURE ASSESSMENT

### ✅ **What's Good:**

1. **Clear SSOT:** `VIVIANA_USERS` is the single source
2. **Consistent ID scheme:** `user_${timestamp}_${random}`
3. **Proper foreign key pattern:** All metadata uses `userId`
4. **Atomic-style signup:** All initialization in one flow
5. **Duplicate prevention:** Checks before creating
6. **Ledger system:** Complete audit trail for credits
7. **Admin reads from SSOT:** No separate admin database

### ⚠️ **Potential Issues:**

1. **No Backend:** All data in browser (volatile)
2. **No Encryption:** Passwords stored in plaintext
3. **No Cross-Browser Sync:** Each browser = separate database
4. **No Transactions:** localStorage writes aren't atomic
5. **Quota Limits:** localStorage ~5-10MB per domain
6. **No Validation:** Email format, password strength minimal

### 🚨 **Critical for Production:**

**This architecture is ONLY suitable for:**
- ✅ Prototypes
- ✅ Demos
- ✅ Local development
- ✅ POC (Proof of Concept)

**NOT suitable for:**
- ❌ Production
- ❌ Multiple users (real app)
- ❌ Sensitive data
- ❌ Cross-device access

---

## 🛠️ FUNCTIONS REFERENCE

### **User Creation:**
| Function | Location | Purpose |
|----------|----------|---------|
| `handleSignup()` | script.js:855 | Main signup handler |
| `saveUserToDatabase()` | script.js:192 | Saves to VIVIANA_USERS |
| `generateUserId()` | script.js:185 | Creates unique ID |
| `addCreditsLedgerEntry()` | script.js:72 | Adds ledger transaction |

### **User Retrieval:**
| Function | Location | Purpose |
|----------|----------|---------|
| `findUserByEmail()` | script.js:218 | Find in VIVIANA_USERS |
| `getUserFromDatabase()` | script.js:213 | Get by userId |
| `searchUserReferences()` | script.js:371 | Find all user data |

### **Admin Panel:**
| Function | Location | Purpose |
|----------|----------|---------|
| `loadUsersData()` | admin-script.js:150 | Load from VIVIANA_USERS |
| `renderUsersTable()` | admin-script.js:173 | Display in table |
| `getUserStatus()` | admin-script.js:135 | Get user status |

### **Debug Tools:**
| Function | Location | Purpose |
|----------|----------|---------|
| `debugFindUserByEmail()` | admin-script.js | Admin debug search |
| `debugCheckTargetEmails()` | admin-script.js | Check specific emails |
| `checkDataConsistency()` | script.js:448 | Validate data integrity |

---

## 📋 CHECKLIST: Single Source of Truth Compliance

### ✅ **Implemented:**
- [x] VIVIANA_USERS is the single user registry
- [x] All user data references userId
- [x] Signup creates user in SSOT first
- [x] Admin panel reads from SSOT
- [x] No parallel user stores
- [x] Foreign key pattern (userId) used consistently
- [x] Duplicate email prevention
- [x] Data consistency checks available

### ⚠️ **Needs Improvement:**
- [ ] Password hashing (currently plaintext)
- [ ] Email validation (format check)
- [ ] Atomic transactions (localStorage limitation)
- [ ] Cross-browser sync (backend needed)
- [ ] Data backup/export
- [ ] Migration to real database for production

---

## 🎯 SUMMARY

**Current System:**
- ✅ **SSOT defined:** `VIVIANA_USERS`
- ✅ **Consistent references:** All data uses `userId`
- ✅ **Signup → Admin flow:** Same data source
- ✅ **No parallel stores:** Single registry

**Why Users Might Be Invisible:**
1. Never registered (localStorage empty)
2. Different browser/profile (localStorage isolated)
3. Soft-deleted (status: "deleted")
4. Browser data cleared

**Fix:**
→ Use debug tools to check if users exist
→ Re-register if needed
→ Ensure same browser for signup + admin

**Status: ✅ ARCHITECTURE IS CORRECT**

The SSOT is properly implemented. If users are invisible, it's a **data existence** problem, not an **architecture** problem.
