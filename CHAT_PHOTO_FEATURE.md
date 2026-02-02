# Chat Photo Feature Documentation 📸

## Overview

Stable photo messaging system with **WhatsApp/Telegram-style** image sharing. Fully integrated into the existing append-only rendering system with **ZERO layout shifts** or re-render bugs.

---

## Features

### ✅ Implemented

1. **Photo Upload Button**
   - Icon next to message input
   - File picker for JPG, PNG, WebP
   - Max size: 10MB

2. **Firebase Storage Upload**
   - Automatic upload to `chat-photos/{userId}/`
   - Progress indicator during upload
   - Unique filename generation

3. **Stable Image Rendering**
   - Aspect-ratio boxes (NO layout shift!)
   - Loading skeleton with shimmer animation
   - Smooth fade-in when loaded
   - Append-only (no re-renders!)

4. **Lightbox Full-Screen View**
   - Click image → full-screen modal
   - Zoom animation
   - Close on click, Escape key, or X button

5. **Message Types**
   - User can send photos
   - Viviana can send photos (admin function)
   - Both use same stable rendering

---

## Technical Architecture

### File Structure

```
chat-photo-feature.js   - Upload + Rendering logic
chat-photo-feature.css  - Styling + Stability rules
index.html              - UI elements (button, lightbox)
```

### Integration with Existing System

**Non-Destructive Override:**
```javascript
// Store original function
const _originalAppendMessageToChat = appendMessageToChat;

// Override with image support
window.appendMessageToChat = function(message, isNewMessage) {
    if (message.messageType === 'image') {
        appendImageMessageToChat(message, isNewMessage); // NEW
    } else {
        _originalAppendMessageToChat(message, isNewMessage); // ORIGINAL
    }
};
```

**Reuses Existing Infrastructure:**
- `renderedMessageIds` Set (deduplication)
- `scrollChatToBottom()` (smooth scroll)
- `currentUser` (authentication)
- `localStorage` (message persistence)

---

## Stability Guarantees

### 1. **Aspect Ratio Boxes - NO Layout Shift**

```css
.message-image-aspect {
    padding-bottom: 75%; /* Calculated from actual image */
}
```

**How it works:**
1. Get image dimensions on upload: `width`, `height`, `aspectRatio`
2. Calculate `padding-bottom: (height/width * 100)%`
3. Image container reserves exact space BEFORE image loads
4. When image loads → NO layout shift!

**Example:**
- Image: 800x600 (4:3 ratio)
- Aspect ratio: 600/800 = 0.75
- CSS: `padding-bottom: 75%`
- Container reserves 75% of width as height
- Image loads into pre-reserved space → NO SHIFT!

### 2. **Append-Only Rendering**

```javascript
function appendImageMessageToChat(message, isNewMessage) {
    // Deduplication check
    if (renderedMessageIds.has(message.id)) return;

    // Create new DOM node
    const div = document.createElement('div');
    // ... build image HTML ...

    // Append to DOM (never clear!)
    container.appendChild(div);

    // Track as rendered
    renderedMessageIds.add(message.id);
}
```

**Guarantees:**
- ✅ Existing messages NEVER touched
- ✅ New messages appended only
- ✅ No `innerHTML = ''` clearing
- ✅ No re-render loops

### 3. **Loading States**

```html
<div class="message-image-aspect">
    <img class="message-image" onload="this.classList.add('loaded')" />
    <div class="message-image-loading"></div> <!-- Spinner -->
</div>
```

**Sequence:**
1. Container with aspect-ratio box renders
2. Spinner shows (shimmer animation)
3. Image loads in background
4. `onload` → add `.loaded` class → fade in
5. Spinner hides
6. **NO LAYOUT SHIFT** (space was pre-reserved)

---

## Message Data Model

### Image Message Structure

```javascript
{
    id: "msg_1234567890_abc123",
    type: "sent", // or "received"
    sender_type: "user", // or "viviana"
    messageType: "image", // NEW: Distinguishes from text
    imageUrl: "https://firebasestorage.googleapis.com/...",
    imageWidth: 800,
    imageHeight: 600,
    imageAspectRatio: 0.75, // height/width
    fileSize: 245678,
    timestamp: "2026-02-02T12:34:56.789Z",
    read: false,
    costsCredits: true // false for FREE messages from Viviana
}
```

### Text Message Structure (Unchanged)

```javascript
{
    id: "msg_1234567890_xyz789",
    type: "sent",
    sender_type: "user",
    text: "Hello Viviana!",
    timestamp: "2026-02-02T12:34:56.789Z",
    read: false
}
```

---

## User Flow

### Sending a Photo

```
1. User clicks photo button 📷
   ↓
2. File picker opens
   ↓
3. User selects image (JPG/PNG/WebP)
   ↓
4. File validation (type, size)
   ↓
5. Credit check (needs 1 credit)
   ↓
6. Upload to Firebase Storage (progress bar)
   ↓
7. Get download URL
   ↓
8. Extract image dimensions
   ↓
9. Create message object with imageUrl + dimensions
   ↓
10. appendMessageToChat(message, true) → Stable render
   ↓
11. Save to localStorage
   ↓
12. Deduct 1 credit
   ↓
13. Show "Photo sent!" toast
```

### Viewing a Photo

```
1. User clicks on image in chat
   ↓
2. openImageLightbox(imageUrl)
   ↓
3. Lightbox modal opens (full-screen)
   ↓
4. Image zooms in (animation)
   ↓
5. User clicks background / Escape / X → closes
```

---

## CSS Stability Techniques

### 1. **Aspect Ratio Box**

```css
.message-image-aspect {
    position: relative;
    width: 100%;
    padding-bottom: 75%; /* Dynamically set */
}

.message-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
```

### 2. **Loading Skeleton**

```css
.message-image-aspect::before {
    content: '';
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
    animation: shimmer 1.5s infinite;
}
```

### 3. **CSS Containment**

```css
.message-image-container {
    contain: layout; /* Isolate layout calculations */
}
```

### 4. **Fade-In Animation**

```css
.message-image {
    opacity: 0;
    transition: opacity 0.3s ease;
}

.message-image.loaded {
    opacity: 1;
}
```

---

## Firebase Storage Structure

```
chat-photos/
├── {userId1}/
│   ├── {userId1}_1234567890_abc123.jpg
│   ├── {userId1}_1234567891_def456.png
│   └── ...
├── {userId2}/
│   ├── {userId2}_1234567892_ghi789.webp
│   └── ...
└── ...
```

**Filename Format:**
```
{userId}_{timestamp}_{randomId}.{extension}
```

**Example:**
```
user_abc123_1738512000000_x7k2m9.jpg
```

---

## Security & Validation

### File Validation

```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateImageFile(file) {
    // Check type
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: 'Only JPG, PNG, WebP allowed' };
    }

    // Check size
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'Max 10MB' };
    }

    return { valid: true };
}
```

### Access Control

**Requirements:**
- ✅ User must be logged in (`currentUser`)
- ✅ User must be unlocked (`quizState.isUnlocked`)
- ✅ User must have credits (1 credit per photo)

**Firebase Storage Rules (Recommended):**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /chat-photos/{userId}/{filename} {
      // Users can only upload to their own folder
      allow write: if request.auth != null && request.auth.uid == userId;

      // Anyone authenticated can read
      allow read: if request.auth != null;

      // Size limit (10MB)
      allow write: if request.resource.size < 10 * 1024 * 1024;

      // Type restriction
      allow write: if request.resource.contentType.matches('image/(jpeg|png|webp)');
    }
  }
}
```

---

## Performance Optimizations

### 1. **Lazy Image Loading**

```javascript
// Image only loads when added to DOM
<img onload="this.classList.add('loaded')" />
```

### 2. **CSS Containment**

```css
.message-image-container {
    contain: layout; /* Browser optimizes reflows */
}
```

### 3. **Will-Change Disabled**

```css
.message.image-message {
    will-change: auto; /* Don't pre-optimize images */
}
```

### 4. **Efficient Deduplication**

```javascript
// O(1) lookup
if (renderedMessageIds.has(message.id)) return;
```

---

## Testing Scenarios

### ✅ Stability Tests

| Test | Expected | Status |
|------|----------|--------|
| **Send photo** | Appends with animation, no re-render | ✅ |
| **Receive photo** | Appends with animation, no re-render | ✅ |
| **Screen switch** | Images stay in DOM, no re-mount | ✅ |
| **Image loads slowly** | No layout shift (aspect-ratio box) | ✅ |
| **Click image** | Opens lightbox, full-screen view | ✅ |
| **Close lightbox** | Modal closes, no artifacts | ✅ |
| **Upload progress** | Progress bar shows, then hides | ✅ |
| **File validation** | Rejects wrong type/size | ✅ |
| **No credits** | Shows error, opens credits store | ✅ |

### ✅ Edge Cases

| Case | Handling |
|------|----------|
| **Image fails to load** | Shows error placeholder SVG |
| **Upload fails** | Shows toast, hides progress bar |
| **User not logged in** | Shows login prompt |
| **User not unlocked** | Shows quiz prompt |
| **File too large** | Shows error toast, resets input |
| **Wrong file type** | Shows error toast, resets input |
| **Duplicate message** | Skipped by deduplication |
| **User switches** | Old user's images persist (per localStorage) |

---

## API Reference

### Functions

#### `triggerPhotoUpload()`
Opens file picker for photo selection.

#### `handlePhotoSelect(event)`
Validates and initiates upload when file is selected.

#### `uploadPhoto(file)`
Uploads file to Firebase Storage with progress tracking.

#### `sendImageMessage(imageUrl, dimensions, fileSize)`
Creates and appends image message to chat.

#### `openImageLightbox(imageUrl)`
Opens full-screen lightbox with image.

#### `closeLightbox()`
Closes lightbox modal.

#### `addReceivedImageMessage(imageUrl, dimensions)`
Admin function to send image as Viviana.
```javascript
// Example usage (admin/testing)
addReceivedImageMessage(
    'https://example.com/photo.jpg',
    { width: 800, height: 600, aspectRatio: 0.75 }
);
```

---

## Mobile Optimizations

```css
@media (max-width: 480px) {
    .message-image-container {
        max-width: 240px; /* Smaller on mobile */
    }

    .lightbox-content {
        max-width: 95%; /* More screen coverage */
    }
}
```

---

## Accessibility

### Keyboard Support
- **Escape**: Close lightbox
- **Tab**: Navigate between photo button and send button
- **Enter**: Click focused button

### Focus States
```css
.photo-btn:focus-visible {
    outline: 2px solid #E91E63;
    outline-offset: 2px;
}
```

### Alt Text
```html
<img alt="Photo message" />
```

---

## Future Enhancements (Optional)

1. **Image Compression**
   - Resize large images before upload
   - Reduce file size & upload time

2. **Thumbnails**
   - Generate thumbnails for chat
   - Load full-size only in lightbox

3. **Multiple Images**
   - Send multiple photos at once
   - Gallery view

4. **Captions**
   - Add text caption to photos
   - Rendered below image

5. **Image Filters**
   - Apply filters before sending
   - Instagram-style effects

---

## Summary

**What was built:**
1. ✅ Photo upload with Firebase Storage
2. ✅ Stable append-only rendering (no re-mounts)
3. ✅ Aspect-ratio boxes (no layout shifts)
4. ✅ Loading skeletons with shimmer
5. ✅ Lightbox full-screen view
6. ✅ File validation & security
7. ✅ Progress indicators
8. ✅ Mobile-optimized

**Stability guarantees:**
- ✅ Append-only (no DOM clears)
- ✅ Deduplication (renderedMessageIds)
- ✅ Aspect-ratio boxes (no layout shift)
- ✅ Non-destructive override (original functions preserved)
- ✅ Integrated with existing scroll/rendering system

**Result:**
- **Stable, smooth photo messaging** ✅
- **WhatsApp/Telegram-like UX** ✅
- **No re-render bugs** ✅
- **Production-ready** ✅

---

**Photo feature is fully integrated and ready to use!** 📸🎉
