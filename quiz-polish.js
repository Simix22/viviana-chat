/* ============================================
   QUIZ POLISH - ENHANCED INTERACTIONS
   Smooth transitions, animations, state handling
   ============================================ */

// Enhanced renderQuestion with smooth transitions and icons
function renderQuestion() {
    // Safety check
    if (!quizQuestions || quizState.currentQuestion >= quizQuestions.length) {
        console.error('❌ Invalid quiz state');
        return;
    }

    const question = quizQuestions[quizState.currentQuestion];
    const currentStep = quizState.currentQuestion + 1;

    console.log(`📝 Rendering question ${currentStep}/6:`, question.question);

    // Update progress with smooth animation
    updateProgressBar(currentStep);
    updateProgressSteps(currentStep);

    // Get elements
    const questionCard = document.querySelector('.quiz-question-card');
    const questionElement = document.getElementById('quizQuestion');
    const choicesElement = document.getElementById('quizChoices');

    if (!questionCard || !questionElement || !choicesElement) {
        console.error('❌ Quiz elements not found');
        return;
    }

    // Add slide-out animation
    questionCard.style.opacity = '0';
    questionCard.style.transform = 'translateY(30px)';

    setTimeout(() => {
        // Update content
        questionElement.textContent = question.question;

        // Render choice cards with icons
        choicesElement.innerHTML = '';
        question.choices.forEach((choice, index) => {
            const choiceCard = createChoiceCard(choice, index);
            choicesElement.appendChild(choiceCard);
        });

        // Slide in with new content
        requestAnimationFrame(() => {
            questionCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            questionCard.style.opacity = '1';
            questionCard.style.transform = 'translateY(0)';
        });

        // Stagger animation for choices
        const choices = choicesElement.querySelectorAll('.quiz-choice');
        choices.forEach((choice, index) => {
            choice.style.opacity = '0';
            choice.style.transform = 'translateY(20px)';

            setTimeout(() => {
                choice.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                choice.style.opacity = '1';
                choice.style.transform = 'translateY(0)';
            }, index * 80);
        });
    }, 200);
}

// Create choice card with icon
function createChoiceCard(choice, index) {
    const card = document.createElement('div');
    card.className = 'quiz-choice';
    card.onclick = () => selectChoiceEnhanced(index, card);

    // Extract emoji from text (if present)
    const emojiMatch = choice.text.match(/[\u{1F300}-\u{1F9FF}]/u);
    const emoji = emojiMatch ? emojiMatch[0] : '✨';
    const text = choice.text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

    card.innerHTML = `
        <div class="quiz-choice-icon">${emoji}</div>
        <div class="quiz-choice-text">${text}</div>
    `;

    return card;
}

// Enhanced choice selection with smooth feedback
function selectChoiceEnhanced(choiceIndex, cardElement) {
    // Prevent double-tap
    if (quizState.isAnimating) {
        console.log('⚠️ Animation in progress, ignoring click');
        return;
    }

    // Safety checks
    if (!quizQuestions || quizState.currentQuestion >= quizQuestions.length) {
        console.error('❌ Invalid quiz state');
        return;
    }

    quizState.isAnimating = true;

    const question = quizQuestions[quizState.currentQuestion];
    const choice = question.choices[choiceIndex];

    console.log('✅ Choice selected:', choice.text);

    // Add selected state to card
    cardElement.classList.add('selected');

    // Disable other choices
    const allChoices = document.querySelectorAll('.quiz-choice');
    allChoices.forEach(c => {
        c.style.pointerEvents = 'none'; // Disable all clicks
        if (c !== cardElement) {
            c.style.opacity = '0.5';
        }
    });

    // Store answer
    quizState.answers.push({
        question: question.question,
        choice: choice.text,
        match: choice.match
    });

    // Show match feedback after brief delay
    setTimeout(() => {
        showMatchFeedbackEnhanced(choice.match);

        // Move to next question or finish
        setTimeout(() => {
            hideMatchFeedbackEnhanced();

            if (quizState.currentQuestion < quizQuestions.length - 1) {
                quizState.currentQuestion++;
                quizState.isAnimating = false;
                renderQuestion();
            } else {
                // Quiz completed!
                console.log('🎉 All questions answered, finishing quiz...');
                finishQuizEnhanced();
            }
        }, 1200); // Match feedback duration
    }, 400); // Delay before showing feedback
}

// Update progress bar with smooth animation
function updateProgressBar(currentStep) {
    const progressText = document.getElementById('quizCurrentStep');
    const progressFill = document.getElementById('quizProgressFill');

    progressText.textContent = currentStep;

    const progress = (currentStep / 6) * 100;
    progressFill.style.width = progress + '%';
}

// Update progress steps (nodes)
function updateProgressSteps(currentStep) {
    const steps = document.querySelectorAll('.quiz-step');

    steps.forEach((step, index) => {
        const stepNumber = index + 1;

        // Remove all classes
        step.classList.remove('completed', 'current');

        if (stepNumber < currentStep) {
            step.classList.add('completed');
        } else if (stepNumber === currentStep) {
            step.classList.add('current');
        }
    });
}

// Enhanced match feedback with better animation
function showMatchFeedbackEnhanced(matchText) {
    const feedback = document.getElementById('matchFeedback');
    const subtext = document.getElementById('matchSubtext');
    const matchContent = feedback.querySelector('.match-content');

    subtext.textContent = matchText;
    feedback.style.display = 'flex';

    // Reset animation
    matchContent.style.animation = 'none';

    requestAnimationFrame(() => {
        matchContent.style.animation = 'matchSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    });
}

// Hide match feedback smoothly
function hideMatchFeedbackEnhanced() {
    const feedback = document.getElementById('matchFeedback');
    const matchContent = feedback.querySelector('.match-content');

    matchContent.style.opacity = '0';
    matchContent.style.transform = 'scale(0.8)';

    setTimeout(() => {
        feedback.style.display = 'none';
        matchContent.style.opacity = '1';
        matchContent.style.transform = 'scale(1)';
    }, 300);
}

// Enhanced finish quiz with better confetti
async function finishQuizEnhanced() {
    console.log('🎉 Quiz completed! Unlocking chat...');

    // Mark as unlocked
    quizState.isUnlocked = true;

    // Save to localStorage
    localStorage.setItem(`VIVIANA_${currentUser.userId}_UNLOCKED`, 'true');

    // Save to Firestore (if available)
    try {
        if (window.db && currentUser && currentUser.userId) {
            await db.collection('users').doc(currentUser.userId).set({
                isUnlocked: true,
                unlockedAt: new Date(),
                quizAnswers: quizState.answers
            }, { merge: true });

            console.log('✅ Unlock status saved to Firestore');
        }
    } catch (error) {
        console.log('📝 Firestore not available:', error.message);
    }

    // Show unlock modal with enhanced confetti
    showChatState('unlockModal');
    startEnhancedConfetti();

    // Stop confetti after 6 seconds
    setTimeout(() => {
        stopConfetti();
    }, 6000);
}

// Enhanced confetti animation
function startEnhancedConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Particle settings
    const colors = ['#E91E63', '#FF4081', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800', '#F44336'];
    const particles = [];
    const particleCount = 150;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5,
            opacity: 1,
            shape: Math.random() > 0.5 ? 'circle' : 'square'
        });
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((particle, index) => {
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation * Math.PI / 180);
            ctx.globalAlpha = particle.opacity;
            ctx.fillStyle = particle.color;

            if (particle.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            }

            ctx.restore();

            // Update position
            particle.y += particle.speedY;
            particle.x += particle.speedX;
            particle.rotation += particle.rotationSpeed;

            // Fade out near bottom
            if (particle.y > canvas.height - 100) {
                particle.opacity -= 0.02;
            }

            // Reset particle if out of bounds
            if (particle.y > canvas.height || particle.opacity <= 0) {
                particle.y = -20;
                particle.x = Math.random() * canvas.width;
                particle.opacity = 1;
            }
        });

        confettiAnimationId = requestAnimationFrame(animate);
    }

    animate();
}

// Override original functions if they exist
if (typeof renderQuestion !== 'undefined') {
    console.log('⚠️ Overriding original renderQuestion with enhanced version');
}

if (typeof selectChoice !== 'undefined') {
    // Alias for backward compatibility
    window.selectChoice = selectChoiceEnhanced;
}

if (typeof finishQuiz !== 'undefined') {
    window.finishQuiz = finishQuizEnhanced;
}

if (typeof showMatchFeedback !== 'undefined') {
    window.showMatchFeedback = showMatchFeedbackEnhanced;
}

if (typeof hideMatchFeedback !== 'undefined') {
    window.hideMatchFeedback = hideMatchFeedbackEnhanced;
}

// Add isAnimating flag to quizState
if (typeof quizState !== 'undefined') {
    quizState.isAnimating = false;
}

// Enhanced start chat with focus
function startChatWithVivianaEnhanced() {
    console.log('💬 Starting chat with Viviana');

    // Stop confetti
    if (typeof stopConfetti === 'function') {
        stopConfetti();
    }

    // Show actual chat
    showChatState('actualChat');

    // Scroll to bottom
    setTimeout(() => {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Focus input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.focus();
        }
    }, 300);
}

// Override startChatWithViviana if it exists
if (typeof startChatWithViviana !== 'undefined') {
    window.startChatWithViviana = startChatWithVivianaEnhanced;
}

console.log('✨ Quiz Polish enhancements loaded');
