/* ============================================
   CHAT PHOTO FEATURE - STABLE IMAGE MESSAGING
   Firebase Storage + Append-only rendering
   ============================================ */

// Firebase Storage reference
let firebaseStorage = null;

// Initialize Firebase Storage
function initFirebaseStorage() {
    if (window.firebase && firebase.storage && !firebaseStorage) {
        try {
            firebaseStorage = firebase.storage();
            console.log('✅ Firebase Storage initialized');
        } catch (error) {
            console.error('❌ Firebase Storage init error:', error);
        }
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseStorage);
} else {
    initFirebaseStorage();
}

// File validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: 'Only JPG, PNG, and WebP images are allowed' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'File too large. Max size: 10MB' };
    }

    return { valid: true };
}

// Trigger file input click
function triggerPhotoUpload() {
    if (!currentUser) {
        showToast('Please log in to send photos', 'error');
        return;
    }

    if (!quizState || !quizState.isUnlocked) {
        showToast('Complete the quiz to unlock photo sharing', 'error');
        return;
    }

    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.click();
    }
}

// Handle photo selection
function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
        showToast(validation.error, 'error');
        event.target.value = ''; // Reset input
        return;
    }

    // Check credits
    const credits = parseInt(localStorage.getItem(`VIVIANA_${currentUser.userId}_CREDITS`) || '0');
    if (credits <= 0) {
        showToast('You need credits to send photos', 'error');
        showCreditsStore();
        event.target.value = '';
        return;
    }

    // Upload photo
    uploadPhoto(file);

    // Reset input
    event.target.value = '';
}

// Upload photo to Firebase Storage
async function uploadPhoto(file) {
    if (!firebaseStorage) {
        showToast('Firebase Storage not initialized', 'error');
        return;
    }

    console.log('📤 Uploading photo:', file.name);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const extension = file.name.split('.').pop();
    const filename = `${currentUser.userId}_${timestamp}_${randomId}.${extension}`;
    const storagePath = `chat-photos/${currentUser.userId}/${filename}`;

    // Create storage reference
    const storageRef = firebaseStorage.ref(storagePath);

    // Show upload progress UI
    const progressElement = showUploadProgress();

    try {
        // Upload file
        const uploadTask = storageRef.put(file);

        // Monitor upload progress
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                updateUploadProgress(progressElement, progress);
                console.log(`Upload progress: ${progress.toFixed(1)}%`);
            },
            (error) => {
                console.error('❌ Upload error:', error);
                hideUploadProgress(progressElement);
                showToast('Failed to upload photo', 'error');
            },
            async () => {
                // Upload complete - get download URL
                try {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log('✅ Photo uploaded:', downloadURL);

                    // Hide progress UI
                    hideUploadProgress(progressElement);

                    // Get image dimensions
                    const dimensions = await getImageDimensions(file);

                    // Send image message
                    sendImageMessage(downloadURL, dimensions, file.size);

                } catch (error) {
                    console.error('❌ Error getting download URL:', error);
                    hideUploadProgress(progressElement);
                    showToast('Failed to get image URL', 'error');
                }
            }
        );

    } catch (error) {
        console.error('❌ Upload failed:', error);
        hideUploadProgress(progressElement);
        showToast('Failed to upload photo', 'error');
    }
}

// Get image dimensions
function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.height / img.width // for CSS padding-bottom
                });
            };
            img.onerror = () => {
                resolve({ width: 800, height: 600, aspectRatio: 0.75 }); // Default 4:3
            };
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
}

// Send image message (APPEND-ONLY, integrates with existing system)
function sendImageMessage(imageUrl, dimensions, fileSize) {
    if (!currentUser) return;

    // Generate unique message ID
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const message = {
        id: messageId,
        type: 'sent',
        sender_type: 'user',
        messageType: 'image', // NEW: Distinguish from text messages
        imageUrl: imageUrl,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
        imageAspectRatio: dimensions.aspectRatio,
        fileSize: fileSize,
        timestamp: new Date().toISOString(),
        read: false
    };

    // Append to chat immediately (uses existing append function!)
    appendMessageToChat(message, true); // isNewMessage = true

    // Force scroll to bottom (user sent message)
    scrollChatToBottom(true);

    // Save to localStorage
    const messages = JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]');
    messages.push(message);
    localStorage.setItem(`VIVIANA_${currentUser.userId}_MESSAGES`, JSON.stringify(messages));

    // Deduct credit
    const credits = parseInt(localStorage.getItem(`VIVIANA_${currentUser.userId}_CREDITS`) || '0');
    const newCredits = credits - 1;
    localStorage.setItem(`VIVIANA_${currentUser.userId}_CREDITS`, newCredits);
    updateCreditsDisplay();

    console.log('✅ Image message sent:', messageId);

    showToast('Photo sent!', 'success');
}

// Show upload progress UI
function showUploadProgress() {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'photo-upload-progress';
    progressDiv.innerHTML = `
        <div class="photo-upload-text">Uploading photo...</div>
        <div class="photo-upload-progress-bar">
            <div class="photo-upload-progress-fill" style="width: 0%"></div>
        </div>
    `;
    document.body.appendChild(progressDiv);
    return progressDiv;
}

// Update upload progress
function updateUploadProgress(element, progress) {
    if (!element) return;
    const fill = element.querySelector('.photo-upload-progress-fill');
    if (fill) {
        fill.style.width = progress + '%';
    }
}

// Hide upload progress UI
function hideUploadProgress(element) {
    if (!element) return;
    element.style.opacity = '0';
    setTimeout(() => {
        element.remove();
    }, 300);
}

// Open image in lightbox
function openImageLightbox(imageUrl) {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = document.getElementById('lightboxImage');

    if (lightbox && lightboxImage) {
        lightboxImage.src = imageUrl;
        lightbox.style.display = 'flex';

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Close on Escape key
        document.addEventListener('keydown', handleLightboxEscape);
    }
}

// Close lightbox
function closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = document.getElementById('lightboxImage');

    if (lightbox && lightboxImage) {
        lightbox.style.display = 'none';
        lightboxImage.src = '';

        // Restore body scroll
        document.body.style.overflow = '';

        // Remove escape listener
        document.removeEventListener('keydown', handleLightboxEscape);
    }
}

// Handle escape key
function handleLightboxEscape(event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
}

// ============================================
// EXTEND appendMessageToChat FOR IMAGE SUPPORT
// ============================================

// Store original appendMessageToChat
const _originalAppendMessageToChat = appendMessageToChat;

// Override with image support
window.appendMessageToChat = function(message, isNewMessage = false) {
    // If it's an image message, render image
    if (message.messageType === 'image') {
        appendImageMessageToChat(message, isNewMessage);
    } else {
        // Use original function for text messages
        _originalAppendMessageToChat(message, isNewMessage);
    }
};

// Append image message to chat (APPEND-ONLY, NO RE-RENDER)
function appendImageMessageToChat(message, isNewMessage = false) {
    // Deduplication check (reuse existing Set)
    if (renderedMessageIds.has(message.id)) {
        console.log('⏭️ Image message already rendered, skipping:', message.id);
        return;
    }

    const container = document.getElementById('chatMessages');
    if (!container) return;

    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    const div = document.createElement('div');
    div.dataset.messageId = message.id;

    // Calculate aspect ratio for stable layout
    const aspectRatio = message.imageAspectRatio || 0.75; // Default 4:3
    const paddingBottom = (aspectRatio * 100).toFixed(2) + '%';

    const imageHTML = `
        <div class="message-image-container" onclick="openImageLightbox('${message.imageUrl}')">
            <div class="message-image-aspect" style="padding-bottom: ${paddingBottom};">
                <img
                    class="message-image"
                    src="${message.imageUrl}"
                    alt="Photo message"
                    onload="this.classList.add('loaded')"
                    onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22%23999%22%3EFailed to load%3C/text%3E%3C/svg%3E'"
                />
                <div class="message-image-loading"></div>
            </div>
            <span class="message-time">${time}${message.costsCredits === false ? ' (FREE)' : ''}</span>
        </div>
    `;

    if (message.sender_type === 'viviana' || message.type === 'received') {
        // Image from Viviana
        div.className = 'message received image-message';
        if (isNewMessage) div.classList.add('new-message');
        div.innerHTML = `
            <div class="message-avatar">V</div>
            <div class="message-bubble">
                ${imageHTML}
            </div>
        `;
    } else if (message.sender_type === 'user' || message.type === 'sent') {
        // Image from User
        div.className = 'message sent image-message';
        if (isNewMessage) div.classList.add('new-message');
        div.innerHTML = `
            <div class="message-bubble">
                ${imageHTML}
            </div>
        `;
    }

    // Append to DOM (stable, no re-render)
    container.appendChild(div);

    // Track as rendered
    renderedMessageIds.add(message.id);

    console.log('✅ Image message appended:', message.id);
}

// ============================================
// VIVIANA CAN SEND PHOTOS TOO
// ============================================

// Add received image message (from Viviana)
function addReceivedImageMessage(imageUrl, dimensions) {
    if (!currentUser) return;

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const message = {
        id: messageId,
        type: 'received',
        sender_type: 'viviana',
        messageType: 'image',
        imageUrl: imageUrl,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
        imageAspectRatio: dimensions.aspectRatio,
        timestamp: new Date().toISOString(),
        costsCredits: false,
        read: false
    };

    // Append to chat with animation
    appendMessageToChat(message, true);

    // Auto-scroll if user near bottom
    scrollChatToBottom(false);

    // Save to localStorage
    const messages = JSON.parse(localStorage.getItem(`VIVIANA_${currentUser.userId}_MESSAGES`) || '[]');
    messages.push(message);
    localStorage.setItem(`VIVIANA_${currentUser.userId}_MESSAGES`, JSON.stringify(messages));

    console.log('✅ Received image message:', messageId);
}

// Expose globally for admin/testing
window.addReceivedImageMessage = addReceivedImageMessage;

console.log('✅ Chat photo feature loaded');
