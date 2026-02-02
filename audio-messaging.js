/* ============================================
   AUDIO MESSAGING SYSTEM
   Voice messages with stable append-only rendering
   ============================================ */

// ========================================
// CONFIGURATION
// ========================================

const AUDIO_CONFIG = {
    MAX_DURATION: 120000, // 120 seconds (2 minutes)
    MIME_TYPE: 'audio/webm;codecs=opus', // Best browser support
    FALLBACK_MIME: 'audio/ogg;codecs=opus',
    SAMPLE_RATE: 48000,
    BUBBLE_HEIGHT: 56 // Fixed height for layout stability
};

// ========================================
// STATE
// ========================================

let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let audioStream = null;

// ========================================
// AUDIO RECORDING
// ========================================

/**
 * Start audio recording
 */
async function startAudioRecording() {
    try {
        console.log('🎤 Starting audio recording');

        // Check if user is logged in and unlocked
        if (!currentUser) {
            showToast('Please log in to send audio', 'error');
            return;
        }

        // Request microphone permission
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: AUDIO_CONFIG.SAMPLE_RATE
            }
        });

        // Determine MIME type support
        let mimeType = AUDIO_CONFIG.MIME_TYPE;
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = AUDIO_CONFIG.FALLBACK_MIME;
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = ''; // Let browser choose
            }
        }

        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(audioStream, { mimeType });
        audioChunks = [];
        recordingStartTime = Date.now();

        // Handle data available
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        // Handle recording stop
        mediaRecorder.onstop = async () => {
            const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            console.log(`🎤 Recording stopped. Duration: ${duration}s`);

            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });

            // Stop all tracks
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }

            // Upload and send
            await uploadAndSendAudio(audioBlob, duration);

            // Cleanup
            audioChunks = [];
            recordingStartTime = null;
        };

        // Start recording
        mediaRecorder.start();

        // Update UI
        showRecordingUI();

        // Auto-stop after max duration
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopAudioRecording();
                showToast('Max recording time reached (2 min)', 'info');
            }
        }, AUDIO_CONFIG.MAX_DURATION);

        // Start timer display
        startRecordingTimer();

    } catch (error) {
        console.error('❌ Failed to start recording:', error);

        if (error.name === 'NotAllowedError') {
            showToast('Microphone permission denied', 'error');
        } else {
            showToast('Failed to start recording', 'error');
        }

        cancelAudioRecording();
    }
}

/**
 * Stop audio recording
 */
function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        stopRecordingTimer();
        hideRecordingUI();
    }
}

/**
 * Cancel audio recording
 */
function cancelAudioRecording() {
    if (mediaRecorder) {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        mediaRecorder = null;
    }

    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }

    audioChunks = [];
    recordingStartTime = null;
    stopRecordingTimer();
    hideRecordingUI();

    console.log('🚫 Recording cancelled');
}

// ========================================
// RECORDING UI
// ========================================

/**
 * Show recording UI
 */
function showRecordingUI() {
    const recordingUI = document.getElementById('audioRecordingUI');
    if (recordingUI) {
        recordingUI.style.display = 'flex';
    }

    // Hide normal input
    const inputCenter = document.querySelector('.chat-input-center');
    if (inputCenter) {
        inputCenter.style.display = 'none';
    }
}

/**
 * Hide recording UI
 */
function hideRecordingUI() {
    const recordingUI = document.getElementById('audioRecordingUI');
    if (recordingUI) {
        recordingUI.style.display = 'none';
    }

    // Show normal input
    const inputCenter = document.querySelector('.chat-input-center');
    if (inputCenter) {
        inputCenter.style.display = 'flex';
    }
}

/**
 * Start recording timer
 */
function startRecordingTimer() {
    const timerElement = document.getElementById('recordingTimer');
    if (!timerElement) return;

    recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

/**
 * Stop recording timer
 */
function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

// ========================================
// UPLOAD & SEND
// ========================================

/**
 * Upload audio to Firebase Storage and send message
 */
async function uploadAndSendAudio(audioBlob, duration) {
    try {
        console.log('📤 Uploading audio...', { size: audioBlob.size, duration });

        // Show upload progress
        showToast('Sending audio...', 'info');

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `audio_${currentUser.userId}_${timestamp}.webm`;
        const storagePath = `audio-messages/${currentUser.userId}/${filename}`;

        // Upload to Firebase Storage
        const storageRef = firebase.storage().ref(storagePath);
        const uploadTask = storageRef.put(audioBlob);

        // Monitor upload progress
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`📤 Upload progress: ${progress.toFixed(0)}%`);
            },
            (error) => {
                console.error('❌ Upload failed:', error);
                showToast('Failed to send audio', 'error');
            },
            async () => {
                // Upload complete, get download URL
                const audioUrl = await uploadTask.snapshot.ref.getDownloadURL();
                console.log('✅ Audio uploaded:', audioUrl);

                // Send message
                await sendAudioMessage(audioUrl, duration);

                showToast('Audio sent!', 'success');
            }
        );

    } catch (error) {
        console.error('❌ Failed to upload audio:', error);
        showToast('Failed to send audio', 'error');
    }
}

/**
 * Send audio message to Firestore
 */
async function sendAudioMessage(audioUrl, duration) {
    const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: currentUser.userId,
        messageType: 'audio',
        audioUrl: audioUrl,
        duration: duration,
        createdAt: new Date().toISOString(),
        read: false
    };

    // Save to localStorage (for now)
    const messagesKey = 'vivianaAdminMessages';
    const existingMessages = JSON.parse(localStorage.getItem(messagesKey) || '[]');
    existingMessages.push(message);
    localStorage.setItem(messagesKey, JSON.stringify(existingMessages));

    console.log('✅ Audio message sent:', message);

    // Append to chat (stable, no re-render)
    appendMessageToChat(message, true);
}

// ========================================
// RENDER AUDIO MESSAGE
// ========================================

/**
 * Append audio message to chat (non-destructive)
 */
function appendAudioMessageToChat(message, isNewMessage) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // Check if already rendered (deduplication)
    if (typeof renderedMessageIds !== 'undefined' && renderedMessageIds.has(message.id)) {
        console.log('⏭️ Audio message already rendered:', message.id);
        return;
    }

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUser.userId ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;

    if (isNewMessage) {
        messageDiv.classList.add('new-message');
    }

    // Audio bubble HTML
    const audioBubbleHTML = `
        <div class="message-audio">
            <button class="audio-play-btn" onclick="toggleAudioPlayback('${message.id}')" aria-label="Play audio">
                <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
            </button>
            <div class="audio-waveform">
                <div class="audio-progress" id="audioProgress_${message.id}">
                    <div class="audio-progress-bar" style="width: 0%"></div>
                </div>
                <div class="audio-duration">${formatDuration(message.duration || 0)}</div>
            </div>
            <audio id="audio_${message.id}" src="${message.audioUrl}" preload="metadata"></audio>
        </div>
        <span class="message-time">${formatMessageTime(message.createdAt)}</span>
    `;

    // Add avatar for received messages
    if (message.senderId !== currentUser.userId) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = 'V';
        messageDiv.appendChild(avatarDiv);
    }

    // Add bubble
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.innerHTML = audioBubbleHTML;
    messageDiv.appendChild(bubbleDiv);

    // Append to container (stable positioning)
    messagesContainer.appendChild(messageDiv);

    // Mark as rendered
    if (typeof renderedMessageIds !== 'undefined') {
        renderedMessageIds.add(message.id);
    }

    // Scroll to bottom if new message
    if (isNewMessage) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }

    console.log('✅ Audio message appended:', message.id);
}

// ========================================
// AUDIO PLAYBACK
// ========================================

let currentlyPlayingAudio = null;

/**
 * Toggle audio playback
 */
function toggleAudioPlayback(messageId) {
    const audioElement = document.getElementById(`audio_${messageId}`);
    const playBtn = audioElement.closest('.message-audio').querySelector('.audio-play-btn');
    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');

    if (!audioElement) return;

    // Stop currently playing audio
    if (currentlyPlayingAudio && currentlyPlayingAudio !== audioElement) {
        currentlyPlayingAudio.pause();
        currentlyPlayingAudio.currentTime = 0;
        resetAudioUI(currentlyPlayingAudio);
    }

    if (audioElement.paused) {
        // Play
        audioElement.play();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        currentlyPlayingAudio = audioElement;

        // Update progress
        audioElement.addEventListener('timeupdate', () => {
            updateAudioProgress(messageId, audioElement);
        });

        // Reset on end
        audioElement.addEventListener('ended', () => {
            resetAudioUI(audioElement);
            currentlyPlayingAudio = null;
        });
    } else {
        // Pause
        audioElement.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        currentlyPlayingAudio = null;
    }
}

/**
 * Update audio progress bar
 */
function updateAudioProgress(messageId, audioElement) {
    const progressBar = document.querySelector(`#audioProgress_${messageId} .audio-progress-bar`);
    if (!progressBar || !audioElement.duration) return;

    const progress = (audioElement.currentTime / audioElement.duration) * 100;
    progressBar.style.width = `${progress}%`;
}

/**
 * Reset audio UI
 */
function resetAudioUI(audioElement) {
    const playBtn = audioElement.closest('.message-audio').querySelector('.audio-play-btn');
    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');
    const progressBar = audioElement.closest('.message-audio').querySelector('.audio-progress-bar');

    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    if (progressBar) {
        progressBar.style.width = '0%';
    }
}

// ========================================
// UTILITIES
// ========================================

/**
 * Format duration (seconds to MM:SS)
 */
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format message time
 */
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    console.log(`🔔 Toast: ${message} (${type})`);
    // TODO: Implement visual toast notification
    // For now, just log
}

// ========================================
// OVERRIDE APPEND MESSAGE
// ========================================

// Store original function
const _originalAppendMessageToChat = typeof appendMessageToChat !== 'undefined' ? appendMessageToChat : null;

// Override to handle audio messages
window.appendMessageToChat = function(message, isNewMessage) {
    if (message.messageType === 'audio') {
        appendAudioMessageToChat(message, isNewMessage);
    } else if (_originalAppendMessageToChat) {
        _originalAppendMessageToChat(message, isNewMessage);
    }
};

// Make functions globally available
window.startAudioRecording = startAudioRecording;
window.stopAudioRecording = stopAudioRecording;
window.cancelAudioRecording = cancelAudioRecording;
window.toggleAudioPlayback = toggleAudioPlayback;

console.log('✅ Audio Messaging System initialized');
